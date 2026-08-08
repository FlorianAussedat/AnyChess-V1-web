import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useFocusEffect } from 'expo-router';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { createOpponentEngine } from '@/lib/engines';
import type { ChessEngine } from '@/lib/engine';
import { parseChessVoice } from '@/lib/voice';
import {
  classifyAttempt,
  classifySpokenAttempt,
  computeScore,
  generateBlindSequence,
  sequenceKey,
  DEFAULT_BLIND_SPEED,
  BLIND_SPEED_MIN,
  BLIND_SPEED_MAX,
  resolveBlindOrientation,
  BlindRecordsStore,
  BLIND_RECORD_INELIGIBLE_MESSAGE,
  evaluateBlindRecordResult,
  type BlindAttemptRecord,
  type BlindOrientation,
  type BlindPerspective,
  type BlindPhase,
  type BlindScore,
  type BlindSequenceMove,
  type BlindSubmode,
} from '@/lib/blind';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { useBlindDictation } from '@/hooks/useBlindDictation';
import { useBlindVisualReplay } from '@/hooks/useBlindVisualReplay';
import { speechService } from '@/services/SpeechService';
import { audioSettings } from '@/services/AudioSettings';
import { preferencesStore } from '@/lib/preferences';
import { formatSanForDisplay } from '@/lib/chess/notation';
import { tMsg } from '@/lib/i18n';
import { defaultKeyValueStorage } from '@/lib/storage';

const blindRecordsStore = new BlindRecordsStore(defaultKeyValueStorage);

interface BlindSequenceContextValue {
  phase: BlindPhase;
  submode: BlindSubmode | null;
  orientation: BlindOrientation;
  perspective: BlindPerspective;
  fullMoves: number;
  /** Shared speed level 1 (slow) → 10 (fast) for dictation + observation. */
  speed: number;
  sequence: BlindSequenceMove[];
  expectedIndex: number;
  board: (BoardPiece | null)[][];
  lastMove: LastMove | null;
  isSpeaking: boolean;
  isGenerating: boolean;
  generateError: string | null;
  score: BlindScore | null;
  lastFeedback: string | null;
  revealedHint: string | null;
  /** Temporary SAN / verbal interpretation shown after a spoken attempt. */
  recognizedText: string | null;
  observationIndex: number;
  /** True while an automatic visual replay is running (observation or results). */
  isReplaying: boolean;
  /** False after first mistake / help / skip — permanently for this attempt. */
  recordEligible: boolean;
  /** One-shot notice when eligibility is lost (null after dismiss / new attempt). */
  recordIneligibleNotice: string | null;
  /** Best perfect full-move count for the current submode. */
  modeRecordBest: number;
  /** Set on results when this attempt beat the previous record. */
  isNewRecord: boolean;
  /** Dictation: how many half-moves have been spoken (0…sequence.length). */
  dictationSpokenCount: number;
  /** Dictation: last move of the sequence has been queued. */
  dictationComplete: boolean;
  setPerspective: (p: BlindPerspective) => void;
  setFullMoves: (n: number) => void;
  setSpeed: (level: number) => void;
  selectSubmode: (m: BlindSubmode) => void;
  backToHub: () => void;
  startSession: () => Promise<void>;
  replayDictation: () => void;
  startReconstruction: () => void;
  startRecitation: () => void;
  getLegalDestinations: (square: string) => string[];
  attemptMove: (from: string, to: string) => boolean;
  attemptSpoken: (raw: string) => 'correct' | 'wrong' | 'illegal' | 'recognition-failure';
  useHelp: () => void;
  /** Pass the current expected move without scoring it as correct. */
  skipExpectedMove: () => void;
  retrySameSequence: () => void;
  generateNewSequence: () => Promise<void>;
  reviewSequenceVisually: () => void;
  backToSettings: () => void;
}

const BlindSequenceContext = createContext<BlindSequenceContextValue | null>(null);
const previousKeyRefGlobal = { current: null as string | null };

export function BlindSequenceProvider({ children }: { children: React.ReactNode }) {
  // Created on focus / cleared on blur — avoid orphan Workers when Stack keeps
  // this route mounted after the user leaves Blind mode.
  const engineRef = useRef<ChessEngine | null>(null);

  const gameRef = useRef(new Chess());
  const sequenceRef = useRef<BlindSequenceMove[]>([]);
  const firstAttemptOkRef = useRef<boolean[]>([]);
  const attemptsRef = useRef<BlindAttemptRecord[]>([]);
  const triedCurrentRef = useRef(false);
  const recognizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(DEFAULT_BLIND_SPEED);
  const perspectiveRef = useRef<BlindPerspective>('white');
  const submodeRef = useRef<BlindSubmode | null>(null);

  const [phase, setPhase] = useState<BlindPhase>('hub');
  const [submode, setSubmode] = useState<BlindSubmode | null>(null);
  const [orientation, setOrientation] = useState<BlindOrientation>('w');
  const [perspective, setPerspectiveState] = useState<BlindPerspective>('white');
  const [fullMoves, setFullMovesState] = useState(3);
  const [speed, setSpeedState] = useState(DEFAULT_BLIND_SPEED);
  const [sequence, setSequence] = useState<BlindSequenceMove[]>([]);
  const [expectedIndex, setExpectedIndex] = useState(0);
  const [observationIndex, setObservationIndex] = useState(0);
  const [board, setBoard] = useState<(BoardPiece | null)[][]>(
    () => gameRef.current.board() as (BoardPiece | null)[][],
  );
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [score, setScore] = useState<BlindScore | null>(null);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [revealedHint, setRevealedHint] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState<string | null>(null);
  const [recordEligible, setRecordEligible] = useState(true);
  const [recordIneligibleNotice, setRecordIneligibleNotice] = useState<string | null>(null);
  const [modeRecordBest, setModeRecordBest] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [dictationSpokenCount, setDictationSpokenCount] = useState(0);
  const [dictationComplete, setDictationComplete] = useState(false);
  const recordEligibleRef = useRef(true);

  const { speakSequence, clearDictationTimer } = useBlindDictation(speedRef);

  const refreshModeRecord = useCallback(async (m: BlindSubmode | null) => {
    if (!m) {
      setModeRecordBest(0);
      return;
    }
    try {
      setModeRecordBest(await blindRecordsStore.loadBest(m));
    } catch {
      setModeRecordBest(0);
    }
  }, []);

  const resetRecordEligibility = useCallback(() => {
    recordEligibleRef.current = true;
    setRecordEligible(true);
    setRecordIneligibleNotice(null);
    setIsNewRecord(false);
  }, []);

  const markRecordIneligible = useCallback(() => {
    if (!recordEligibleRef.current) return;
    recordEligibleRef.current = false;
    setRecordEligible(false);
    setRecordIneligibleNotice(BLIND_RECORD_INELIGIBLE_MESSAGE);
  }, []);

  const setFullMoves = useCallback((n: number) => {
    setFullMovesState(Math.max(1, Math.min(20, Math.round(n))));
  }, []);

  const setSpeed = useCallback((level: number) => {
    const clamped = Math.max(
      BLIND_SPEED_MIN,
      Math.min(BLIND_SPEED_MAX, Math.round(level)),
    );
    speedRef.current = clamped;
    setSpeedState(clamped);
  }, []);

  const setPerspective = useCallback((p: BlindPerspective) => {
    perspectiveRef.current = p;
    setPerspectiveState(p);
    if (p !== 'random') {
      setOrientation(resolveBlindOrientation(p));
    }
  }, []);

  const clearRecognizedTimer = useCallback(() => {
    if (recognizedTimerRef.current != null) {
      clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = null;
    }
  }, []);

  const showRecognized = useCallback(
    (text: string | null) => {
      clearRecognizedTimer();
      if (!text) {
        setRecognizedText(null);
        return;
      }
      setRecognizedText(text);
      recognizedTimerRef.current = setTimeout(() => {
        recognizedTimerRef.current = null;
        setRecognizedText(null);
      }, 1500);
    },
    [clearRecognizedTimer],
  );

  useEffect(() => {
    submodeRef.current = submode;
  }, [submode]);

  useFocusEffect(
    useCallback(() => {
      if (!engineRef.current) {
        engineRef.current = createOpponentEngine();
      }
      engineRef.current.init?.().catch(() => {});
      return () => {
        const engine = engineRef.current;
        engineRef.current = null;
        engine?.cancel?.();
        engine?.destroy?.();
      };
    }, []),
  );

  const syncBoard = useCallback(() => {
    setBoard(gameRef.current.board() as (BoardPiece | null)[][]);
  }, []);

  const {
    isReplaying,
    setIsReplaying,
    playVisualReplay,
    playResultReplay,
    playVisualReplayRef,
    replayRef,
    resultReplayRef,
  } = useBlindVisualReplay({
    gameRef,
    speedRef,
    syncBoard,
    setLastMove,
    setObservationIndex,
    setExpectedIndex,
    setPhase,
    setLastFeedback,
  });

  useEffect(() => {
    audioSettings.ensureLoaded().catch(() => {});
    const unsubSpeaking = speechService.onSpeakingChange(setIsSpeaking);
    const unsubCancel = speechService.onCancel(() => clearDictationTimer());
    return () => {
      unsubSpeaking();
      unsubCancel();
      speechService.stop();
      replayRef.current.cancel();
      resultReplayRef.current?.cancel();
      clearDictationTimer();
      clearRecognizedTimer();
    };
  }, [clearDictationTimer, clearRecognizedTimer, replayRef, resultReplayRef]);

  const resetBoard = useCallback(() => {
    gameRef.current.reset();
    setLastMove(null);
    setExpectedIndex(0);
    setObservationIndex(0);
    setLastFeedback(null);
    setRevealedHint(null);
    triedCurrentRef.current = false;
    syncBoard();
  }, [syncBoard]);

  const finishSession = useCallback(() => {
    const s = computeScore(
      sequenceRef.current.length,
      firstAttemptOkRef.current,
      attemptsRef.current,
    );
    setScore(s);
    setPhase('results');
    const mode = submodeRef.current;
    const halfMoves = sequenceRef.current.length;
    const firstOk = [...firstAttemptOkRef.current];
    const attempts = [...attemptsRef.current];
    if (mode) {
      void (async () => {
        let previous = 0;
        try {
          previous = await blindRecordsStore.loadBest(mode);
        } catch {
          previous = modeRecordBest;
        }
        const evaluation = evaluateBlindRecordResult(
          mode,
          halfMoves,
          firstOk,
          attempts,
          previous,
        );
        setIsNewRecord(evaluation.isNewRecord);
        if (evaluation.isNewRecord) {
          try {
            const best = await blindRecordsStore.saveFullMoves(
              mode,
              evaluation.fullMoves,
            );
            setModeRecordBest(best);
          } catch {
            /* ignore persist errors */
          }
          speechService.speak(
            `Exercice terminé. Nouveau record : ${evaluation.fullMoves} coups complets.`,
            { flush: true },
          );
        } else {
          speechService.speak(
            `Exercice terminé. Précision au premier essai : ${s.accuracyPercent} pour cent.`,
            { flush: true },
          );
        }
      })();
    } else {
      setIsNewRecord(false);
      speechService.speak(
        `Exercice terminé. Précision au premier essai : ${s.accuracyPercent} pour cent.`,
        { flush: true },
      );
    }
    if (submodeRef.current === 'watch-recite') {
      playVisualReplayRef.current(sequenceRef.current, { after: 'keep-final' });
    } else if (submodeRef.current === 'listen-reconstruct') {
      playResultReplay(sequenceRef.current);
    }
  }, [playResultReplay, playVisualReplayRef, modeRecordBest]);

  const beginListenPath = useCallback(
    (moves: BlindSequenceMove[]) => {
      sequenceRef.current = moves;
      setSequence(moves);
      previousKeyRefGlobal.current = sequenceKey(moves);
      firstAttemptOkRef.current = moves.map(() => false);
      attemptsRef.current = [];
      setScore(null);
      resetRecordEligibility();
      setDictationSpokenCount(0);
      setDictationComplete(false);
      setPhase('dictation');
      speakSequence(moves, true, {
        onSpokenCount: (n) => setDictationSpokenCount(n),
        onComplete: () => setDictationComplete(true),
      });
    },
    [speakSequence, resetRecordEligibility],
  );

  const runObservation = useCallback(
    (moves: BlindSequenceMove[]) => {
      sequenceRef.current = moves;
      setSequence(moves);
      previousKeyRefGlobal.current = sequenceKey(moves);
      firstAttemptOkRef.current = moves.map(() => false);
      attemptsRef.current = [];
      setScore(null);
      resetRecordEligibility();
      setDictationSpokenCount(0);
      setDictationComplete(false);
      setPhase('observing');
      // Keep the final observed position visible until the user starts recitation.
      playVisualReplay(moves, { after: 'keep-final' });
    },
    [playVisualReplay, resetRecordEligibility],
  );

  const selectSubmode = useCallback((m: BlindSubmode) => {
    setSubmode(m);
    setPhase('settings');
    void refreshModeRecord(m);
  }, [refreshModeRecord]);

  const backToHub = useCallback(() => {
    speechService.cancel('back-hub');
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    showRecognized(null);
    setIsReplaying(false);
    setSubmode(null);
    setPhase('hub');
    setScore(null);
    resetBoard();
  }, [resetBoard, clearDictationTimer, showRecognized, replayRef, resultReplayRef, setIsReplaying]);

  const startSession = useCallback(async () => {
    if (!submode) return;
    setIsGenerating(true);
    setGenerateError(null);
    setPhase('generating');
    speechService.cancel('start-session');
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    setIsReplaying(false);
    const resolved = resolveBlindOrientation(perspectiveRef.current);
    setOrientation(resolved);
    try {
      const moves = await generateBlindSequence({
        fullMoves,
        engine: engineRef.current!,
        previousKey: previousKeyRefGlobal.current,
      });
      if (moves.length < 2) {
        throw new Error('Impossible de générer une séquence. Réessaie.');
      }
      if (submode === 'listen-reconstruct') beginListenPath(moves);
      else runObservation(moves);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
      setPhase('settings');
    } finally {
      setIsGenerating(false);
    }
  }, [
    submode,
    fullMoves,
    beginListenPath,
    runObservation,
    clearDictationTimer,
    replayRef,
    resultReplayRef,
    setIsReplaying,
  ]);

  const replayDictation = useCallback(() => {
    if (sequenceRef.current.length === 0) return;
    setDictationSpokenCount(0);
    setDictationComplete(false);
    speakSequence(sequenceRef.current, true, {
      onSpokenCount: (n) => setDictationSpokenCount(n),
      onComplete: () => setDictationComplete(true),
    });
  }, [speakSequence]);

  const startReconstruction = useCallback(() => {
    speechService.cancel('reconstruction');
    clearDictationTimer();
    showRecognized(null);
    resetBoard();
    setPhase('reconstruction');
  }, [resetBoard, clearDictationTimer, showRecognized]);

  const startRecitation = useCallback(() => {
    speechService.cancel('recitation');
    clearDictationTimer();
    replayRef.current.cancel();
    setIsReplaying(false);
    showRecognized(null);
    resetBoard();
    setPhase('recitation');
    setLastFeedback('Récite la séquence à voix haute, coup par coup.');
  }, [resetBoard, clearDictationTimer, showRecognized, replayRef, setIsReplaying]);

  const skipExpectedMove = useCallback(() => {
    if (phase !== 'recitation') return;
    const expected = sequenceRef.current[expectedIndex];
    if (!expected) return;
    attemptsRef.current.push({ expectedIndex, kind: 'help', attemptedSan: '(passé)' });
    markRecordIneligible();
    triedCurrentRef.current = false;
    // Apply the expected move on the board so the position stays consistent.
    try {
      const onBoard = gameRef.current.move({
        from: expected.from,
        to: expected.to,
        promotion: expected.promotion || 'q',
      }) as Move;
      setLastMove({ from: onBoard.from, to: onBoard.to });
      syncBoard();
    } catch {
      /* ignore */
    }
    setRevealedHint(null);
    setLastFeedback(tMsg('blind.moveSkipped'));
    speechService.speak(tMsg('blind.moveSkipped'), { flush: true });
    const next = expectedIndex + 1;
    if (next >= sequenceRef.current.length) {
      setExpectedIndex(next);
      finishSession();
    } else {
      setExpectedIndex(next);
    }
  }, [phase, expectedIndex, syncBoard, finishSession, markRecordIneligible]);

  const getLegalDestinations = useCallback(
    (square: string): string[] => {
      if (phase !== 'reconstruction') return [];
      const game = gameRef.current;
      const piece = game.get(square as Square);
      if (!piece || piece.color !== game.turn()) return [];
      try {
        const moves = game.moves({ verbose: true, square: square as Square }) as Move[];
        return [...new Set(moves.map((m) => m.to))];
      } catch {
        return [];
      }
    },
    [phase],
  );

  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (phase !== 'reconstruction') return false;
      const game = gameRef.current;
      const expected = sequenceRef.current[expectedIndex];
      if (!expected) return false;

      let played: Move;
      try {
        played = game.move({ from, to, promotion: 'q' }) as Move;
      } catch {
        attemptsRef.current.push({
          expectedIndex,
          kind: 'wrong-move',
          attemptedSan: `${from}${to}`,
        });
        markRecordIneligible();
        triedCurrentRef.current = true;
        const msg = tMsg('blind.illegal');
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        return false;
      }

      const remaining = sequenceRef.current.slice(expectedIndex);
      const verdict = classifyAttempt(expected, played, remaining);
      const isFirstTry = !triedCurrentRef.current;

      if (verdict.ok) {
        if (isFirstTry) firstAttemptOkRef.current[expectedIndex] = true;
        triedCurrentRef.current = false;
        setLastMove({ from: played.from, to: played.to });
        setLastFeedback(tMsg('blind.correct'));
        setRevealedHint(null);
        syncBoard();
        const next = expectedIndex + 1;
        if (next >= sequenceRef.current.length) {
          setExpectedIndex(next);
          finishSession();
        } else {
          setExpectedIndex(next);
        }
        return true;
      }

      attemptsRef.current.push({
        expectedIndex,
        kind: verdict.kind,
        attemptedSan: played.san,
      });
      markRecordIneligible();
      triedCurrentRef.current = true;
      game.undo();
      syncBoard();
      const labels: Record<string, string> = {
        'wrong-piece': 'Erreur de pièce',
        'wrong-destination': "Erreur de case d'arrivée",
        'wrong-order': "Erreur d'ordre",
        'wrong-move': tMsg('blind.moveError'),
      };
      const label = labels[verdict.kind] ?? tMsg('blind.moveError');
      setLastFeedback(label);
      speechService.speak(label, { flush: true });
      return false;
    },
    [phase, expectedIndex, syncBoard, finishSession, markRecordIneligible],
  );

  const attemptSpoken = useCallback(
    (raw: string): 'correct' | 'wrong' | 'illegal' | 'recognition-failure' => {
      if (phase !== 'recitation' && phase !== 'reconstruction') return 'recognition-failure';
      const expected = sequenceRef.current[expectedIndex];
      if (!expected) return 'recognition-failure';

      // Rebuild position up to expectedIndex for the parser.
      const probe = new Chess();
      for (let i = 0; i < expectedIndex; i++) {
        const m = sequenceRef.current[i];
        probe.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      }

      const parsed = parseChessVoice(raw, probe, { mode: 'blind' });

      // Surface recognized interpretation before outcome validation.
      // Format SAN for display notation; keep non-SAN transcripts as-is.
      const notation = preferencesStore.getPreferences().chessNotation;
      if (parsed.type === 'move') {
        showRecognized(formatSanForDisplay(parsed.move.san, notation));
      } else if (parsed.type === 'illegal') {
        showRecognized(
          parsed.intendedDescription ??
            parsed.normalizedTranscript ??
            parsed.rawTranscript,
        );
      } else if (parsed.type === 'ambiguous' && parsed.candidates[0]) {
        showRecognized(
          formatSanForDisplay(parsed.candidates[0].san, notation),
        );
      } else if (parsed.type === 'unrecognized') {
        showRecognized(parsed.normalizedTranscript || parsed.rawTranscript || null);
      } else {
        showRecognized(null);
      }

      if (parsed.type === 'command') {
        attemptsRef.current.push({ expectedIndex, kind: 'recognition-failure' });
        setLastFeedback('Non reconnu — réessaie (non compté comme erreur de mémoire).');
        return 'recognition-failure';
      }

      if (parsed.type === 'unrecognized' || parsed.type === 'ambiguous') {
        attemptsRef.current.push({ expectedIndex, kind: 'recognition-failure' });
        setLastFeedback(
          parsed.type === 'ambiguous'
            ? 'Ambigu — reformule le coup (non compté comme erreur de mémoire).'
            : 'Non reconnu — réessaie (non compté comme erreur de mémoire).',
        );
        return 'recognition-failure';
      }

      if (parsed.type === 'illegal') {
        attemptsRef.current.push({
          expectedIndex,
          kind: 'wrong-move',
          attemptedSan: parsed.intendedDescription ?? parsed.normalizedTranscript,
        });
        markRecordIneligible();
        triedCurrentRef.current = true;
        const msg = tMsg('blind.illegal');
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        return 'illegal';
      }

      const moveToPlay = parsed.move;
      // Is this move legal in the current position?
      const legal = (probe.moves({ verbose: true }) as Move[]).some(
        (m) =>
          m.from === moveToPlay.from &&
          m.to === moveToPlay.to &&
          (m.promotion ?? 'q') === (moveToPlay.promotion ?? 'q'),
      );
      if (!legal) {
        attemptsRef.current.push({
          expectedIndex,
          kind: 'wrong-move',
          attemptedSan: moveToPlay.san,
        });
        markRecordIneligible();
        triedCurrentRef.current = true;
        const msg = tMsg('blind.illegal');
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        return 'illegal';
      }

      let played: Move | null = null;
      try {
        played = probe.move({
          from: moveToPlay.from,
          to: moveToPlay.to,
          promotion: moveToPlay.promotion || 'q',
        }) as Move;
      } catch {
        played = null;
      }

      if (!played) {
        attemptsRef.current.push({
          expectedIndex,
          kind: 'wrong-move',
          attemptedSan: moveToPlay.san,
        });
        markRecordIneligible();
        triedCurrentRef.current = true;
        const msg = tMsg('blind.illegal');
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        return 'illegal';
      }

      const remaining = sequenceRef.current.slice(expectedIndex);
      const verdict = classifySpokenAttempt(expected, played, remaining);
      const isFirstTry = !triedCurrentRef.current;

      if (verdict.ok) {
        if (isFirstTry) firstAttemptOkRef.current[expectedIndex] = true;
        triedCurrentRef.current = false;
        try {
          const onBoard = gameRef.current.move({
            from: played.from,
            to: played.to,
            promotion: played.promotion || 'q',
          }) as Move;
          setLastMove({ from: onBoard.from, to: onBoard.to });
          syncBoard();
        } catch {
          /* ignore */
        }
        setLastFeedback(tMsg('blind.correct'));
        const next = expectedIndex + 1;
        if (next >= sequenceRef.current.length) {
          setExpectedIndex(next);
          finishSession();
        } else {
          setExpectedIndex(next);
        }
        return 'correct';
      }

      if (!verdict.ok && verdict.kind === 'recognition-failure') {
        attemptsRef.current.push({ expectedIndex, kind: 'recognition-failure' });
        setLastFeedback('Non reconnu — réessaie.');
        return 'recognition-failure';
      }

      const kind = !verdict.ok ? verdict.kind : 'wrong-move';
      attemptsRef.current.push({
        expectedIndex,
        kind,
        attemptedSan: played.san,
      });
      markRecordIneligible();
      triedCurrentRef.current = true;
      const label =
        kind === 'wrong-order' ? "Erreur d'ordre" : tMsg('blind.moveError');
      setLastFeedback(label);
      speechService.speak(label, { flush: true });
      return 'wrong';
    },
    [phase, expectedIndex, syncBoard, finishSession, showRecognized, markRecordIneligible],
  );

  const useHelp = useCallback(() => {
    if (phase !== 'reconstruction' && phase !== 'recitation') return;
    const expected = sequenceRef.current[expectedIndex];
    if (!expected) return;
    attemptsRef.current.push({ expectedIndex, kind: 'help' });
    markRecordIneligible();
    triedCurrentRef.current = true;
    const hint = tMsg('blind.expectedMove', { move: expected.verbal });
    setRevealedHint(hint);
    setLastFeedback(tMsg('blind.hintUsed'));
    speechService.speak(hint, { flush: true });
  }, [phase, expectedIndex, markRecordIneligible]);

  const retrySameSequence = useCallback(() => {
    speechService.cancel('retry');
    clearDictationTimer();
    showRecognized(null);
    replayRef.current.cancel();
    setIsReplaying(false);
    firstAttemptOkRef.current = sequenceRef.current.map(() => false);
    attemptsRef.current = [];
    setScore(null);
    resetRecordEligibility();
    if (submode === 'listen-reconstruct') {
      setDictationSpokenCount(0);
      setDictationComplete(false);
      setPhase('dictation');
      speakSequence(sequenceRef.current, true, {
        onSpokenCount: (n) => setDictationSpokenCount(n),
        onComplete: () => setDictationComplete(true),
      });
    } else if (submode === 'watch-recite') {
      setPhase('observing');
      playVisualReplay(sequenceRef.current, { after: 'keep-final' });
    }
  }, [
    submode,
    speakSequence,
    playVisualReplay,
    clearDictationTimer,
    showRecognized,
    replayRef,
    setIsReplaying,
    resetRecordEligibility,
  ]);

  const generateNewSequence = useCallback(async () => {
    await startSession();
  }, [startSession]);

  const reviewSequenceVisually = useCallback(() => {
    if (sequenceRef.current.length === 0) return;
    // Stay on results; replay the same sequence and keep the final position.
    setPhase('results');
    playVisualReplay(sequenceRef.current, { after: 'keep-final' });
  }, [playVisualReplay]);

  const backToSettings = useCallback(() => {
    speechService.cancel('back-settings');
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    showRecognized(null);
    setIsReplaying(false);
    setPhase('settings');
    setScore(null);
    setLastFeedback(null);
    setRevealedHint(null);
    resetBoard();
  }, [
    resetBoard,
    clearDictationTimer,
    showRecognized,
    replayRef,
    resultReplayRef,
    setIsReplaying,
  ]);

  return (
    <BlindSequenceContext.Provider
      value={{
        phase,
        submode,
        orientation,
        perspective,
        fullMoves,
        speed,
        sequence,
        expectedIndex,
        board,
        lastMove,
        isSpeaking,
        isGenerating,
        generateError,
        score,
        lastFeedback,
        revealedHint,
        recognizedText,
        observationIndex,
        isReplaying,
        recordEligible,
        recordIneligibleNotice,
        modeRecordBest,
        isNewRecord,
        dictationSpokenCount,
        dictationComplete,
        setPerspective,
        setFullMoves,
        setSpeed,
        selectSubmode,
        backToHub,
        startSession,
        replayDictation,
        startReconstruction,
        startRecitation,
        getLegalDestinations,
        attemptMove,
        attemptSpoken,
        useHelp,
        skipExpectedMove,
        retrySameSequence,
        generateNewSequence,
        reviewSequenceVisually,
        backToSettings,
      }}
    >
      {children}
    </BlindSequenceContext.Provider>
  );
}

export function useBlindSequence(): BlindSequenceContextValue {
  const ctx = useContext(BlindSequenceContext);
  if (!ctx) throw new Error('useBlindSequence must be used within BlindSequenceProvider');
  return ctx;
}
