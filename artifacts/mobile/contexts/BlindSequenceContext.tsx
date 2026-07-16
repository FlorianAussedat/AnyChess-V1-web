import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { createOpponentEngine } from '@/lib/engines';
import type { ChessEngine } from '@/lib/engine';
import { parseChessVoice } from '@/lib/voice';
import {
  BoardReplayController,
  classifyAttempt,
  classifySpokenAttempt,
  computeScore,
  generateBlindSequence,
  sequenceKey,
  DICTATION_SPEEDS,
  type BlindAttemptRecord,
  type BlindOrientation,
  type BlindPhase,
  type BlindScore,
  type BlindSequenceMove,
  type BlindSubmode,
  type DictationPace,
  type ObservationPace,
} from '@/lib/blind';
import { replayLine, type ReplayLineHandle } from '@/lib/replay';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { speechService } from '@/services/SpeechService';
import { audioSettings } from '@/services/AudioSettings';

interface BlindSequenceContextValue {
  phase: BlindPhase;
  submode: BlindSubmode | null;
  orientation: BlindOrientation;
  fullMoves: number;
  pace: ObservationPace;
  dictationPace: DictationPace;
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
  observationIndex: number;
  /** True while an automatic visual replay is running (observation or results). */
  isReplaying: boolean;
  setOrientation: (o: BlindOrientation) => void;
  setFullMoves: (n: number) => void;
  setPace: (p: ObservationPace) => void;
  setDictationPace: (p: DictationPace) => void;
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
  const engineRef = useRef<ChessEngine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createOpponentEngine();
  }

  const gameRef = useRef(new Chess());
  const sequenceRef = useRef<BlindSequenceMove[]>([]);
  const firstAttemptOkRef = useRef<boolean[]>([]);
  const attemptsRef = useRef<BlindAttemptRecord[]>([]);
  const triedCurrentRef = useRef(false);
  const replayRef = useRef(new BoardReplayController());
  const resultReplayRef = useRef<ReplayLineHandle | null>(null);
  const dictationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paceRef = useRef<ObservationPace>('normal');
  const dictationPaceRef = useRef<DictationPace>('medium');
  const submodeRef = useRef<BlindSubmode | null>(null);

  const [phase, setPhase] = useState<BlindPhase>('hub');
  const [submode, setSubmode] = useState<BlindSubmode | null>(null);
  const [orientation, setOrientation] = useState<BlindOrientation>('w');
  const [fullMoves, setFullMovesState] = useState(3);
  const [pace, setPaceState] = useState<ObservationPace>('normal');
  const [dictationPace, setDictationPaceState] = useState<DictationPace>('medium');
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
  const [isReplaying, setIsReplaying] = useState(false);

  const setFullMoves = useCallback((n: number) => {
    setFullMovesState(Math.max(1, Math.min(20, Math.round(n))));
  }, []);

  const setPace = useCallback((p: ObservationPace) => {
    paceRef.current = p;
    setPaceState(p);
  }, []);

  const setDictationPace = useCallback((p: DictationPace) => {
    dictationPaceRef.current = p;
    setDictationPaceState(p);
  }, []);

  const clearDictationTimer = useCallback(() => {
    if (dictationTimerRef.current != null) {
      clearTimeout(dictationTimerRef.current);
      dictationTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    submodeRef.current = submode;
  }, [submode]);

  useEffect(() => {
    const engine = engineRef.current;
    engine?.init?.().catch(() => {});
    audioSettings.ensureLoaded().catch(() => {});
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
      replayRef.current.cancel();
      resultReplayRef.current?.cancel();
      clearDictationTimer();
      engine?.destroy?.();
    };
  }, [clearDictationTimer]);

  const syncBoard = useCallback(() => {
    setBoard(gameRef.current.board() as (BoardPiece | null)[][]);
  }, []);

  const speakSequence = useCallback((moves: BlindSequenceMove[], flush = true) => {
    clearDictationTimer();
    if (flush) speechService.stop();
    const delay = DICTATION_SPEEDS[dictationPaceRef.current];
    let i = 0;
    const step = () => {
      if (i >= moves.length) return;
      speechService.speak(moves[i].verbal, { rate: 0.92, flush: i === 0 && flush });
      i += 1;
      if (i < moves.length) {
        dictationTimerRef.current = setTimeout(step, delay);
      }
    };
    step();
  }, [clearDictationTimer]);

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

  const playVisualReplay = useCallback(
    (
      moves: BlindSequenceMove[],
      options: { after: 'recitation' | 'keep-final' },
    ) => {
      replayRef.current.cancel();
      gameRef.current.reset();
      setLastMove(null);
      setObservationIndex(0);
      syncBoard();
      setIsReplaying(true);

      replayRef.current.start(moves, paceRef.current, {
        onMove: (m, index) => {
          try {
            const played = gameRef.current.move({
              from: m.from,
              to: m.to,
              promotion: m.promotion || 'q',
            }) as Move;
            setLastMove({ from: played.from, to: played.to });
            syncBoard();
            setObservationIndex(index + 1);
          } catch {
            /* ignore */
          }
        },
        onComplete: () => {
          setIsReplaying(false);
          if (options.after === 'recitation') {
            gameRef.current.reset();
            setLastMove(null);
            syncBoard();
            setExpectedIndex(0);
            setPhase('recitation');
            setLastFeedback('Récite la séquence à voix haute, coup par coup.');
          }
          // keep-final: leave the board on the last position (observation or results)
        },
      });
    },
    [syncBoard],
  );

  const playVisualReplayRef = useRef(playVisualReplay);
  useEffect(() => {
    playVisualReplayRef.current = playVisualReplay;
  }, [playVisualReplay]);

  const playResultReplay = useCallback(
    (moves: BlindSequenceMove[]) => {
      resultReplayRef.current?.cancel();
      gameRef.current.reset();
      setLastMove(null);
      setObservationIndex(0);
      syncBoard();
      setIsReplaying(true);

      resultReplayRef.current = replayLine({
        moves: moves.map((m) => ({
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          san: m.san,
        })),
        intervalMs: 1000,
        onMove: (m, index) => {
          try {
            const played = gameRef.current.move({
              from: m.from,
              to: m.to,
              promotion: m.promotion || 'q',
            }) as Move;
            setLastMove({ from: played.from, to: played.to });
            syncBoard();
            setObservationIndex(index + 1);
          } catch {
            /* ignore */
          }
        },
        onComplete: () => {
          setIsReplaying(false);
        },
      });
    },
    [syncBoard],
  );

  const finishSession = useCallback(() => {
    const s = computeScore(
      sequenceRef.current.length,
      firstAttemptOkRef.current,
      attemptsRef.current,
    );
    setScore(s);
    setPhase('results');
    speechService.speak(
      `Exercice terminé. Précision au premier essai : ${s.accuracyPercent} pour cent.`,
      { flush: true },
    );
    if (submodeRef.current === 'watch-recite') {
      playVisualReplayRef.current(sequenceRef.current, { after: 'keep-final' });
    } else if (submodeRef.current === 'listen-reconstruct') {
      playResultReplay(sequenceRef.current);
    }
  }, [playResultReplay]);

  const beginListenPath = useCallback(
    (moves: BlindSequenceMove[]) => {
      sequenceRef.current = moves;
      setSequence(moves);
      previousKeyRefGlobal.current = sequenceKey(moves);
      firstAttemptOkRef.current = moves.map(() => false);
      attemptsRef.current = [];
      setScore(null);
      setPhase('dictation');
      speakSequence(moves, true);
    },
    [speakSequence],
  );

  const runObservation = useCallback(
    (moves: BlindSequenceMove[]) => {
      sequenceRef.current = moves;
      setSequence(moves);
      previousKeyRefGlobal.current = sequenceKey(moves);
      firstAttemptOkRef.current = moves.map(() => false);
      attemptsRef.current = [];
      setScore(null);
      setPhase('observing');
      // Keep the final observed position visible until the user starts recitation.
      playVisualReplay(moves, { after: 'keep-final' });
    },
    [playVisualReplay],
  );

  const selectSubmode = useCallback((m: BlindSubmode) => {
    setSubmode(m);
    setPhase('settings');
  }, []);

  const backToHub = useCallback(() => {
    speechService.stop();
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    setIsReplaying(false);
    setSubmode(null);
    setPhase('hub');
    setScore(null);
    resetBoard();
  }, [resetBoard, clearDictationTimer]);

  const startSession = useCallback(async () => {
    if (!submode) return;
    setIsGenerating(true);
    setGenerateError(null);
    setPhase('generating');
    speechService.stop();
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    setIsReplaying(false);
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
  }, [submode, fullMoves, beginListenPath, runObservation, clearDictationTimer]);

  const replayDictation = useCallback(() => {
    if (sequenceRef.current.length === 0) return;
    speakSequence(sequenceRef.current, true);
  }, [speakSequence]);

  const startReconstruction = useCallback(() => {
    speechService.stop();
    resetBoard();
    setPhase('reconstruction');
  }, [resetBoard]);

  const startRecitation = useCallback(() => {
    speechService.stop();
    replayRef.current.cancel();
    setIsReplaying(false);
    resetBoard();
    setPhase('recitation');
    setLastFeedback('Récite la séquence à voix haute, coup par coup.');
  }, [resetBoard]);

  const skipExpectedMove = useCallback(() => {
    if (phase !== 'recitation') return;
    const expected = sequenceRef.current[expectedIndex];
    if (!expected) return;
    attemptsRef.current.push({ expectedIndex, kind: 'help', attemptedSan: '(passé)' });
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
    setLastFeedback('Coup passé.');
    speechService.speak('Coup passé.', { flush: true });
    const next = expectedIndex + 1;
    if (next >= sequenceRef.current.length) {
      setExpectedIndex(next);
      finishSession();
    } else {
      setExpectedIndex(next);
    }
  }, [phase, expectedIndex, syncBoard, finishSession]);

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
        setLastFeedback('Coup illégal.');
        return false;
      }

      const remaining = sequenceRef.current.slice(expectedIndex);
      const verdict = classifyAttempt(expected, played, remaining);
      const isFirstTry = !triedCurrentRef.current;

      if (verdict.ok) {
        if (isFirstTry) firstAttemptOkRef.current[expectedIndex] = true;
        triedCurrentRef.current = false;
        setLastMove({ from: played.from, to: played.to });
        setLastFeedback('Correct.');
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
      triedCurrentRef.current = true;
      game.undo();
      syncBoard();
      const labels: Record<string, string> = {
        'wrong-piece': 'Erreur de pièce',
        'wrong-destination': "Erreur de case d'arrivée",
        'wrong-order': "Erreur d'ordre",
        'wrong-move': 'Erreur de coup',
      };
      const label = labels[verdict.kind] ?? 'Erreur';
      setLastFeedback(label);
      speechService.speak(label, { flush: true });
      return false;
    },
    [phase, expectedIndex, syncBoard, finishSession],
  );

  const attemptSpoken = useCallback(
    (raw: string): 'correct' | 'wrong' | 'illegal' | 'recognition-failure' => {
      if (phase !== 'recitation') return 'recognition-failure';
      const expected = sequenceRef.current[expectedIndex];
      if (!expected) return 'recognition-failure';

      // Rebuild position up to expectedIndex for the parser.
      const probe = new Chess();
      for (let i = 0; i < expectedIndex; i++) {
        const m = sequenceRef.current[i];
        probe.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      }

      const parsed = parseChessVoice(raw, probe, { mode: 'blind' });

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
        const msg = 'Coup illégal.';
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
        const msg = 'Coup illégal.';
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
        const msg = 'Coup illégal.';
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
        setLastFeedback('Correct.');
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
      triedCurrentRef.current = true;
      const label =
        kind === 'wrong-order' ? "Erreur d'ordre" : 'Erreur de coup';
      setLastFeedback(label);
      speechService.speak(label, { flush: true });
      return 'wrong';
    },
    [phase, expectedIndex, syncBoard, finishSession],
  );

  const useHelp = useCallback(() => {
    if (phase !== 'reconstruction' && phase !== 'recitation') return;
    const expected = sequenceRef.current[expectedIndex];
    if (!expected) return;
    attemptsRef.current.push({ expectedIndex, kind: 'help' });
    triedCurrentRef.current = true;
    const hint = `Coup attendu : ${expected.verbal}`;
    setRevealedHint(hint);
    setLastFeedback('Aide utilisée');
    speechService.speak(hint, { flush: true });
  }, [phase, expectedIndex]);

  const retrySameSequence = useCallback(() => {
    replayRef.current.cancel();
    setIsReplaying(false);
    firstAttemptOkRef.current = sequenceRef.current.map(() => false);
    attemptsRef.current = [];
    setScore(null);
    if (submode === 'listen-reconstruct') {
      setPhase('dictation');
      speakSequence(sequenceRef.current, true);
    } else if (submode === 'watch-recite') {
      setPhase('observing');
      playVisualReplay(sequenceRef.current, { after: 'keep-final' });
    }
  }, [submode, speakSequence, playVisualReplay]);

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
    speechService.stop();
    replayRef.current.cancel();
    resultReplayRef.current?.cancel();
    clearDictationTimer();
    setIsReplaying(false);
    setPhase('settings');
    setScore(null);
    setLastFeedback(null);
    setRevealedHint(null);
    resetBoard();
  }, [resetBoard, clearDictationTimer]);

  return (
    <BlindSequenceContext.Provider
      value={{
        phase,
        submode,
        orientation,
        fullMoves,
        pace,
        dictationPace,
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
        observationIndex,
        isReplaying,
        setOrientation,
        setFullMoves,
        setPace,
        setDictationPace,
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
