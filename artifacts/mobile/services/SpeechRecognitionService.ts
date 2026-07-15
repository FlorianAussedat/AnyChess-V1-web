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
 *  - Android will later replace this with the native SpeechRecognizer path
 *    from the same package (or a dedicated native module) — keep callers on
 *    this service so the swap is local.
 *
 * Responsibilities:
 *  - availability / permission checks with real web getUserMedia when needed;
 *  - start/stop with logging;
 *  - pause while TTS speaks, resume afterwards (caller still drives isSpeaking);
 *  - surface structured status for the UI.
 */
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CHESS_CONTEXT_STRINGS } from '@/lib/voice';

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
        'La reconnaissance vocale n’est pas disponible dans ce navigateur. Utilise Chrome/Edge, ou saisis le coup au clavier.',
    };
    logMic('unsupported');
    return status;
  }

  if (Platform.OS === 'web') {
    const web = await ensureWebMicrophoneAccess();
    if (web === 'denied') {
      return {
        code: 'permission-denied',
        message: 'Permission microphone refusée. Autorise le micro dans le navigateur.',
      };
    }
    if (web === 'unavailable') {
      return {
        code: 'unavailable',
        message: 'Microphone indisponible sur cet appareil / navigateur.',
      };
    }
  } else {
    try {
      const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        return {
          code: 'permission-denied',
          message: 'Permission microphone refusée.',
        };
      }
    } catch (err) {
      logMic('permission-request-failed', err);
      return {
        code: 'start-failed',
        message: 'Impossible de demander la permission microphone.',
        lastError: String(err),
      };
    }
  }

  return { code: 'idle', message: null };
}

export function startSpeechRecognition(): void {
  ExpoSpeechRecognitionModule.start({
    lang: 'fr-FR',
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
}) {
  const { isSpeaking, enabled = true, onTranscript, forceOff = false } = options;

  const [micActive, setMicActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<MicStatus>({ code: 'idle', message: null });

  const micActiveRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);
  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);
  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  const startListening = useCallback(async () => {
    if (!enabled) return;
    try {
      const prep = await prepareSpeechRecognition();
      if (prep.code !== 'idle') {
        setStatus(prep);
        setMicActive(false);
        return;
      }
      startSpeechRecognition();
      setStatus({ code: 'listening', message: null });
    } catch (err) {
      logMic('start-failed', err);
      setStatus({
        code: 'start-failed',
        message: 'Échec du démarrage de la reconnaissance vocale.',
        lastError: String(err),
      });
      setIsListening(false);
      setMicActive(false);
    }
  }, [enabled]);

  const stopListening = useCallback(() => {
    stopSpeechRecognition();
    setIsListening(false);
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
    setStatus({ code: 'listening', message: null });
    logMic('event-start');
  });

  useSpeechRecognitionEvent('end', () => {
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
        message: 'Permission microphone refusée.',
        lastError: code,
      });
      setMicActive(false);
      return;
    }
    if (code === 'service-not-allowed' || code === 'language-not-supported') {
      setStatus({
        code: 'unsupported',
        message: 'Reconnaissance vocale non supportée ici.',
        lastError: code,
      });
      setMicActive(false);
      return;
    }
    setStatus({
      code: 'error',
      message: `Erreur micro : ${code}`,
      lastError: code,
    });
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    if (!event?.isFinal) return;
    const transcript: string = event.results?.[0]?.transcript ?? '';
    if (!transcript.trim()) {
      logMic('empty-transcript');
      setStatus({
        code: 'empty-transcript',
        message: 'Rien d’utilisable reconnu. Réessaie.',
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

  // Resume / restart after TTS or unexpected end.
  useEffect(() => {
    if (!micActive || isListening || isSpeaking || !enabled) return;
    const t = setTimeout(() => {
      if (micActiveRef.current && !isSpeakingRef.current) startListening();
    }, 100);
    return () => clearTimeout(t);
  }, [micActive, isListening, isSpeaking, enabled, startListening]);

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

// Re-export the hook dependency so screens don't import the module twice.
export { useSpeechRecognitionEvent };
