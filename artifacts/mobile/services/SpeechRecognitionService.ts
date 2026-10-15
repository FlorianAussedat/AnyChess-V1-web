/**
 * Speech recognition facade used by Classic, Opening and Blind-recite modes.
 *
 * Diagnosis (web, July 2026):
 *  - Library: expo-speech-recognition → Web Speech API
 *    (webkitSpeechRecognition / SpeechRecognition).
 *  - requestPermissionsAsync() on web ALWAYS returns granted without prompting;
 *    the real browser mic prompt only appears on recognition.start() / getUserMedia.
 *  - continuous mode ends after silence on Chrome → must restart while micActive.
 *  - Firefox / some embedded browsers lack the Speech API entirely.
 *  - Android dictation uses the on-device Vosk module. It does not fall back to
 *    the online recognizer. Web keeps expo-speech-recognition.
 *
 * Responsibilities:
 *  - availability / permission checks with real web getUserMedia when needed;
 *  - start/stop with logging;
 *  - pause while TTS speaks, resume afterwards (caller still drives isSpeaking);
 *  - surface structured status for the UI.
 */
import { AppState, Platform } from 'react-native';
import * as Network from 'expo-network';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHESS_CONTEXT_STRINGS } from '@/lib/voice';
import { shouldApplyRecognitionResult, shouldRestartRecognition } from '@/lib/speech/micLifecycle';
import { preferencesStore } from '@/lib/preferences';
import { speechLocaleForLanguage } from '@/lib/i18n';
import { tMsg } from '@/lib/i18n/tMsg.ts';
import { getVoskModule } from '@/lib/speech/androidDictation';
import { chessPhraseGrammar, OPEN_VOSK_GRAMMAR } from '@/lib/speech/voskGrammar';
import { decideDictation } from '@/lib/speech/voskDecision';
import { offerOfflineModel } from '@/lib/speech/offlineModelSession';
import { networkKindFromState } from '@/lib/speech/offlineModelFlow';
import {
  activeDictationLanguage,
  formatDownloadSize,
  VOSK_MODELS,
} from '@/lib/speech/voskModels';

export type MicStatusCode =
  | 'idle'
  | 'listening'
  | 'paused-for-tts'
  | 'permission-denied'
  | 'unavailable'
  | 'unsupported'
  | 'start-failed'
  | 'stopped-unexpectedly'
  | 'empty-transcript'
  | 'error';

export interface MicStatus {
  code: MicStatusCode;
  message: string | null;
  lastError?: string;
}

function logMic(event: string, detail?: unknown): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[SpeechRecognition] ${event}`, detail ?? '');
  }
}

export function isSpeechRecognitionSupported(): boolean {
  try {
    return ExpoSpeechRecognitionModule.isRecognitionAvailable();
  } catch {
    return false;
  }
}

/**
 * On web, expo's requestPermissionsAsync is a no-op stub. Trigger a real
 * getUserMedia prompt so the user can grant/deny the microphone.
 */
async function ensureWebMicrophoneAccess(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (Platform.OS !== 'web') return 'granted';
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    logMic('web-mic-api-unavailable');
    return 'unavailable';
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    logMic('web-mic-granted');
    return 'granted';
  } catch (err) {
    const name = err instanceof Error ? err.name : String(err);
    logMic('web-mic-denied', name);
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'denied';
    return 'unavailable';
  }
}

export async function prepareSpeechRecognition(): Promise<MicStatus> {
  if (!isSpeechRecognitionSupported()) {
    const status: MicStatus = {
      code: 'unsupported',
      message:
        tMsg('speech.unavailableBrowser'),
    };
    logMic('unsupported');
    return status;
  }

  if (Platform.OS === 'web') {
    const web = await ensureWebMicrophoneAccess();
    if (web === 'denied') {
      return {
        code: 'permission-denied',
        message: tMsg('speech.micDeniedBrowser'),
      };
    }
    if (web === 'unavailable') {
      return {
        code: 'unavailable',
        message: tMsg('speech.micUnavailableDevice'),
      };
    }
  } else {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        return {
          code: 'permission-denied',
          message: tMsg('speech.micDenied'),
        };
      }
    } catch (err) {
      logMic('permission-request-failed', err);
      return {
        code: 'start-failed',
        message: tMsg('speech.micPermissionFailed'),
        lastError: String(err),
      };
    }
  }

  return { code: 'idle', message: null };
}

export function startSpeechRecognition(): void {
  // Locale follows app language preference (independent of chess notation).
  const lang = speechLocaleForLanguage(
    preferencesStore.getPreferences().language,
  );
  ExpoSpeechRecognitionModule.start({
    lang,
    interimResults: false,
    maxAlternatives: 4,
    continuous: true,
    requiresOnDeviceRecognition: false,
    contextualStrings: CHESS_CONTEXT_STRINGS,
  });
  logMic('start');
}

export function stopSpeechRecognition(): void {
  try {
    ExpoSpeechRecognitionModule.stop();
    logMic('stop');
  } catch (err) {
    logMic('stop-error', err);
  }
}

/**
 * React hook encapsulating mic toggle + TTS pause/resume + status.
 * Callers pass `isSpeaking` from the game context / SpeechService.
 */
export function useSpeechInput(options: {
  isSpeaking: boolean;
  enabled?: boolean;
  onTranscript: (text: string) => void;
  /** When true, auto-deactivate mic (e.g. game over). */
  forceOff?: boolean;
  /**
   * Current position. Android move dictation builds a phrase grammar from
   * every legal move. Omit only for dictation that is not a chess move.
   */
  positionFen?: string | null;
  /** `open` keeps the local model but does not constrain it to chess phrases. */
  dictation?: 'moves' | 'open';
}) {
  const {
    isSpeaking,
    enabled = true,
    onTranscript,
    forceOff = false,
    positionFen = null,
    dictation = 'moves',
  } = options;

  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<MicStatus>({ code: 'idle', message: null });

  const micActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isListeningRef = useRef(false);
  const enabledRef = useRef(enabled);
  /** False after unmount — blocks restart / late async starts. */
  const aliveRef = useRef(true);
  const sessionRef = useRef(0);
  const fenRef = useRef<string | null>(positionFen);
  const sessionFenRef = useRef<string | null>(positionFen);
  const sessionLanguageRef = useRef(activeDictationLanguage(preferencesStore.getPreferences()));
  const lastFingerprintRef = useRef<string | null>(null);
  const dictationRef = useRef(dictation);
  const foregroundRef = useRef(true);
  const [dictationLang, setDictationLang] = useState(() =>
    activeDictationLanguage(preferencesStore.getPreferences()),
  );
  const [foreground, setForeground] = useState(true);
  /** Grammar last sent to the native recognizer, so a position change can retarget it. */
  const appliedGrammarRef = useRef<string | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);
  useEffect(() => {
    return preferencesStore.onChange((prefs) => {
      const next = activeDictationLanguage(prefs);
      if (next !== sessionLanguageRef.current) {
        sessionRef.current += 1;
        lastFingerprintRef.current = null;
        if (Platform.OS === 'android') getVoskModule()?.stop();
      }
      sessionLanguageRef.current = next;
      setDictationLang(next);
    });
  }, []);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  const spokenNow = activeDictationLanguage(preferencesStore.getPreferences());
  const speakingStarted = isSpeaking && !isSpeakingRef.current;
  if (speakingStarted || positionFen !== fenRef.current || spokenNow !== sessionLanguageRef.current) {
    if (micActiveRef.current || isListeningRef.current) {
      sessionRef.current += 1;
      lastFingerprintRef.current = null;
    }
  }
  fenRef.current = positionFen;
  if (spokenNow !== sessionLanguageRef.current && !micActiveRef.current) {
    sessionLanguageRef.current = spokenNow;
  }
  isSpeakingRef.current = isSpeaking;
  useEffect(() => {
    dictationRef.current = dictation;
  }, [dictation]);
  useEffect(() => {
    foregroundRef.current = foreground;
  }, [foreground]);

  const stopListening = useCallback(() => {
    sessionRef.current += 1;
    appliedGrammarRef.current = null;
    if (Platform.OS === 'android') {
      getVoskModule()?.stop();
    } else {
      stopSpeechRecognition();
    }
    if (aliveRef.current) {
      setIsListening(false);
    } else {
      isListeningRef.current = false;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!enabledRef.current || !aliveRef.current) return;
    if (Platform.OS === 'android') {
      await startAndroidDictation({
        aliveRef,
        micActiveRef,
        fenRef,
        sessionFenRef,
        sessionLanguageRef,
        dictationRef,
        sessionRef,
        appliedGrammarRef,
        setStatus,
        setMicActive,
        setIsListening,
      });
      return;
    }
    try {
      const prep = await prepareSpeechRecognition();
      if (!aliveRef.current || !micActiveRef.current) {
        // Unmounted or toggled off while awaiting permissions.
        stopSpeechRecognition();
        return;
      }
      if (prep.code !== 'idle') {
        setStatus(prep);
        setMicActive(false);
        return;
      }
      if (!aliveRef.current || !micActiveRef.current) {
        stopSpeechRecognition();
        return;
      }
      startSpeechRecognition();
      setStatus({ code: 'listening', message: null });
    } catch (err) {
      if (!aliveRef.current) return;
      logMic('start-failed', err);
      setStatus({
        code: 'start-failed',
        message: tMsg('speech.startFailed'),
        lastError: String(err),
      });
      setIsListening(false);
      setMicActive(false);
    }
  }, []);

  // Hard stop on leave — Expo Stack may keep the screen mounted briefly, and
  // continuous-mode restarts must not fire after the user navigates away.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      micActiveRef.current = false;
      sessionRef.current += 1;
      appliedGrammarRef.current = null;
      if (Platform.OS === 'android') getVoskModule()?.stop();
      else stopSpeechRecognition();
      logMic('unmount-stop');
    };
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const active = next === 'active';
      foregroundRef.current = active;
      setForeground(active);
      if (!active) stopListening();
    });
    return () => sub.remove();
  }, [stopListening]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const native = getVoskModule();
    if (!native) return;
    const results = native.addListener('onResult', (event) => {
      const fingerprint = event.alternatives.map((alt) => alt.text).join('|');
      if (
        !shouldApplyRecognitionResult({
          alive: aliveRef.current,
          eventSession: event.session,
          activeSession: sessionRef.current,
          eventFen: sessionFenRef.current,
          activeFen: fenRef.current,
          fingerprint,
          lastFingerprint: lastFingerprintRef.current,
        })
      ) {
        return;
      }
      lastFingerprintRef.current = fingerprint;
      if (dictationRef.current === 'open') {
        const best = event.alternatives[0]?.text?.trim() ?? '';
        if (!best) return;
        onTranscriptRef.current(best);
        setStatus({ code: 'listening', message: null });
        return;
      }
      const fen = sessionFenRef.current;
      if (!fen) return;
      const language = sessionLanguageRef.current;
      const decision = decideDictation(event.alternatives, fen, language);
      if (decision.action === 'play') {
        onTranscriptRef.current(decision.text);
        setStatus({ code: 'listening', message: null });
        return;
      }
      if (decision.action === 'repeat') {
        setStatus({ code: 'empty-transcript', message: tMsg('speech.repeatMove') });
      }
    });
    const errors = native.addListener('onError', (event) => {
      if (!aliveRef.current) return;
      if (event.session !== sessionRef.current && event.session !== -1) return;
      logMic('vosk-error', event.message);
      setStatus({
        code: 'error',
        message: tMsg('speech.offlineEngineFailed'),
        lastError: event.message,
      });
    });
    return () => {
      results.remove();
      errors.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android' || !micActive || !isListening) return;
    const grammar = grammarFor(dictation, positionFen, dictationLang);
    if (
      appliedGrammarRef.current === grammar &&
      sessionLanguageRef.current === dictationLang &&
      sessionFenRef.current === positionFen
    ) {
      return;
    }
    const native = getVoskModule();
    if (!native) return;
    const spec = VOSK_MODELS[dictationLang];
    if (native.status(dictationLang, spec.directory) !== 'installed') {
      sessionRef.current += 1;
      appliedGrammarRef.current = null;
      native.stop();
      void readNetwork().then((network) => offerOfflineModel(dictationLang, network));
      setIsListening(false);
      setMicActive(false);
      setStatus({
        code: 'unavailable',
        message: tMsg('speech.offlineModelNeeded', {
          lang: dictationLang === 'en' ? 'English' : 'français',
          size: formatDownloadSize(spec.downloadBytes, dictationLang),
        }),
      });
      return;
    }
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    sessionFenRef.current = positionFen;
    sessionLanguageRef.current = dictationLang;
    lastFingerprintRef.current = null;
    appliedGrammarRef.current = grammar;
    native.stop();
    const paths = native.paths(dictationLang);
    void native
      .load(`${paths.root}/${spec.directory}`)
      .then(() => {
        if (!aliveRef.current || sessionRef.current !== session) return;
        native.setGrammar(grammar);
        return native.start(session);
      })
      .then(() => {
        if (!aliveRef.current || sessionRef.current !== session) return;
        setIsListening(true);
      })
      .catch((err) => {
        if (!aliveRef.current || sessionRef.current !== session) return;
        logMic('vosk-grammar-restart-failed', err);
        native.stop();
        setIsListening(false);
        setMicActive(false);
        setStatus({
          code: 'start-failed',
          message: tMsg('speech.offlineEngineFailed'),
          lastError: String(err),
        });
      });
  }, [positionFen, dictation, micActive, isListening, dictationLang]);

  useSpeechRecognitionEvent('start', () => {
    if (!aliveRef.current) return;
    setIsListening(true);
    setStatus({ code: 'listening', message: null });
    logMic('event-start');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!aliveRef.current) return;
    setIsListening(false);
    logMic('event-end');
    if (micActiveRef.current && !isSpeakingRef.current) {
      // Chrome continuous sessions often end after a pause — restart.
      setStatus((s) =>
        s.code === 'listening' || s.code === 'idle' || s.code === 'stopped-unexpectedly'
          ? { code: 'idle', message: null }
          : s,
      );
    } else if (micActiveRef.current) {
      setStatus({ code: 'paused-for-tts', message: null });
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    if (!aliveRef.current) return;
    const code = String(event?.error ?? 'unknown');
    const message = String(event?.message ?? '');
    logMic('event-error', { code, message });
    setIsListening(false);

    // Recoverable: no-speech / aborted while still wanting to listen.
    if (code === 'no-speech' || code === 'aborted') {
      return;
    }
    if (code === 'not-allowed') {
      setStatus({
        code: 'permission-denied',
        message: tMsg('speech.micDenied'),
        lastError: code,
      });
      setMicActive(false);
      return;
    }
    if (code === 'service-not-allowed' || code === 'language-not-supported') {
      setStatus({
        code: 'unsupported',
        message: tMsg('speech.unsupported'),
        lastError: code,
      });
      setMicActive(false);
      return;
    }
    setStatus({
      code: 'error',
      message: tMsg('speech.micError', { code }),
      lastError: code,
    });
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    if (!aliveRef.current) return;
    if (!event?.isFinal) return;
    const transcript: string = event.results?.[0]?.transcript ?? '';
    if (!transcript.trim()) {
      logMic('empty-transcript');
      setStatus({
        code: 'empty-transcript',
        message: tMsg('speech.nothingRecognized'),
      });
      return;
    }
    logMic('transcript', transcript);
    setStatus({ code: 'listening', message: null });
    onTranscriptRef.current(transcript);
  });

  // Pause during TTS.
  useEffect(() => {
    if (isSpeaking && micActive && isListening) {
      stopListening();
      setStatus({ code: 'paused-for-tts', message: null });
    }
  }, [isSpeaking, micActive, isListening, stopListening]);

  // Resume / restart after TTS or unexpected end (never after unmount).
  useEffect(() => {
    if (
      !shouldRestartRecognition({
        alive: aliveRef.current,
        enabled,
        micActive,
        isListening,
        isSpeaking,
        foreground,
      })
    ) {
      return;
    }
    const t = setTimeout(() => {
      if (
        shouldRestartRecognition({
          alive: aliveRef.current,
          enabled: enabledRef.current,
          micActive: micActiveRef.current,
          isListening: isListeningRef.current,
          isSpeaking: isSpeakingRef.current,
          foreground: foregroundRef.current,
        })
      ) {
        startListening();
      }
    }, 100);
    return () => clearTimeout(t);
  }, [micActive, isListening, isSpeaking, enabled, foreground, startListening]);

  useEffect(() => {
    if (forceOff && micActive) {
      setMicActive(false);
      stopListening();
    }
  }, [forceOff, micActive, stopListening]);

  const toggleMic = useCallback(() => {
    if (micActive) {
      setMicActive(false);
      stopListening();
      setStatus({ code: 'idle', message: null });
    } else {
      setMicActive(true);
      startListening();
    }
  }, [micActive, startListening, stopListening]);

  return {
    micActive,
    isListening,
    status,
    toggleMic,
    startListening,
    stopListening,
  };
}

function grammarFor(
  dictation: 'moves' | 'open',
  fen: string | null,
  language: 'fr' | 'en',
): string {
  if (dictation === 'open' || !fen) return OPEN_VOSK_GRAMMAR;
  return JSON.stringify(chessPhraseGrammar(fen, language));
}

async function readNetwork(): Promise<'wifi' | 'cellular' | 'offline' | 'unknown'> {
  try {
    return networkKindFromState(await Network.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

async function ensureAndroidMicPermission(): Promise<MicStatus | null> {
  try {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      return { code: 'permission-denied', message: tMsg('speech.micDenied') };
    }
    return null;
  } catch (err) {
    return {
      code: 'start-failed',
      message: tMsg('speech.micPermissionFailed'),
      lastError: String(err),
    };
  }
}

async function startAndroidDictation(refs: {
  aliveRef: { current: boolean };
  micActiveRef: { current: boolean };
  fenRef: { current: string | null };
  sessionFenRef: { current: string | null };
  sessionLanguageRef: { current: 'fr' | 'en' };
  dictationRef: { current: 'moves' | 'open' };
  sessionRef: { current: number };
  appliedGrammarRef: { current: string | null };
  setStatus: (status: MicStatus) => void;
  setMicActive: (active: boolean) => void;
  setIsListening: (listening: boolean) => void;
}): Promise<void> {
  const native = getVoskModule();
  if (!native) {
    refs.setMicActive(false);
    refs.setStatus({ code: 'unsupported', message: tMsg('speech.offlineEngineMissing') });
    return;
  }
  const denied = await ensureAndroidMicPermission();
  if (!refs.aliveRef.current || !refs.micActiveRef.current) {
    native.stop();
    return;
  }
  if (denied) {
    refs.setStatus(denied);
    refs.setMicActive(false);
    return;
  }
  const language = activeDictationLanguage(preferencesStore.getPreferences());
  const spec = VOSK_MODELS[language];
  if (native.status(language, spec.directory) !== 'installed') {
    offerOfflineModel(language, await readNetwork());
    refs.setMicActive(false);
    refs.setStatus({
      code: 'unavailable',
      message: tMsg('speech.offlineModelNeeded', {
        lang: language === 'en' ? 'English' : 'français',
        size: formatDownloadSize(spec.downloadBytes, language),
      }),
    });
    return;
  }
  if (refs.dictationRef.current === 'moves' && !refs.fenRef.current) {
    refs.setMicActive(false);
    refs.setStatus({ code: 'unavailable', message: tMsg('speech.offlineNoPosition') });
    return;
  }
  try {
    const paths = native.paths(language);
    await native.load(`${paths.root}/${spec.directory}`);
    if (!refs.aliveRef.current || !refs.micActiveRef.current) {
      native.stop();
      return;
    }
    const grammar = grammarFor(refs.dictationRef.current, refs.fenRef.current, language);
    native.setGrammar(grammar);
    refs.sessionRef.current += 1;
    const session = refs.sessionRef.current;
    refs.sessionFenRef.current = refs.fenRef.current;
    refs.sessionLanguageRef.current = language;
    await native.start(session);
    if (!refs.aliveRef.current || !refs.micActiveRef.current || refs.sessionRef.current !== session) {
      return;
    }
    refs.appliedGrammarRef.current = grammar;
    refs.setIsListening(true);
    refs.setStatus({ code: 'listening', message: null });
  } catch (err) {
    if (!refs.aliveRef.current) return;
    logMic('vosk-start-failed', err);
    native.stop();
    refs.setIsListening(false);
    refs.setMicActive(false);
    refs.setStatus({
      code: 'start-failed',
      message: tMsg('speech.offlineEngineFailed'),
      lastError: String(err),
    });
  }
}

// Re-export the hook dependency so screens don't import the module twice.
export { useSpeechRecognitionEvent };
