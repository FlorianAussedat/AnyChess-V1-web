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
import {
  classifyAttempt,
  computeScore,
  generateBlindSequence,
  halfMoveCount,
  sequenceKey,
  type BlindAttemptRecord,
  type BlindOrientation,
  type BlindPhase,
  type BlindScore,
  type BlindSequenceMove,
} from '@/lib/blind';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { speechService } from '@/services/SpeechService';

interface BlindSequenceContextValue {
  phase: BlindPhase;
  orientation: BlindOrientation;
  fullMoves: number;
  sequence: BlindSequenceMove[];
  /** Current expected half-move index during reconstruction. */
  expectedIndex: number;
  board: (BoardPiece | null)[][];
  lastMove: LastMove | null;
  isSpeaking: boolean;
  isGenerating: boolean;
  generateError: string | null;
  score: BlindScore | null;
  lastFeedback: string | null;
  revealedHint: string | null;
  setOrientation: (o: BlindOrientation) => void;
  setFullMoves: (n: number) => void;
  startSession: () => Promise<void>;
  replayDictation: () => void;
  startReconstruction: () => void;
  getLegalDestinations: (square: string) => string[];
  attemptMove: (from: string, to: string) => boolean;
  useHelp: () => void;
  retrySameSequence: () => void;
  generateNewSequence: () => Promise<void>;
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

  const [phase, setPhase] = useState<BlindPhase>('settings');
  const [orientation, setOrientation] = useState<BlindOrientation>('w');
  const [fullMoves, setFullMoves] = useState(3);
  const [sequence, setSequence] = useState<BlindSequenceMove[]>([]);
  const [expectedIndex, setExpectedIndex] = useState(0);
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

  useEffect(() => {
    const engine = engineRef.current;
    engine?.init?.().catch(() => {});
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
      engine?.destroy?.();
    };
  }, []);

  const syncBoard = useCallback(() => {
    setBoard(gameRef.current.board() as (BoardPiece | null)[][]);
  }, []);

  const speakSequence = useCallback((moves: BlindSequenceMove[], flush = true) => {
    if (flush) speechService.stop();
    for (const m of moves) {
      speechService.speak(m.verbal, { rate: 0.92 });
    }
  }, []);

  const resetReconstructionBoard = useCallback(() => {
    gameRef.current.reset();
    setLastMove(null);
    setExpectedIndex(0);
    setLastFeedback(null);
    setRevealedHint(null);
    triedCurrentRef.current = false;
    syncBoard();
  }, [syncBoard]);

  const beginDictation = useCallback(
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

  const startSession = useCallback(async () => {
    setIsGenerating(true);
    setGenerateError(null);
    setPhase('generating');
    speechService.stop();
    try {
      const moves = await generateBlindSequence({
        fullMoves,
        engine: engineRef.current!,
        previousKey: previousKeyRefGlobal.current,
      });
      if (moves.length < halfMoveCount(fullMoves)) {
        // Accept shorter if game ended early, but require at least 2 half-moves.
        if (moves.length < 2) {
          throw new Error('Impossible de générer une séquence. Réessaie.');
        }
      }
      beginDictation(moves);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : String(err));
      setPhase('settings');
    } finally {
      setIsGenerating(false);
    }
  }, [fullMoves, beginDictation]);

  const replayDictation = useCallback(() => {
    if (sequenceRef.current.length === 0) return;
    speakSequence(sequenceRef.current, true);
  }, [speakSequence]);

  const startReconstruction = useCallback(() => {
    speechService.stop();
    resetReconstructionBoard();
    setPhase('reconstruction');
  }, [resetReconstructionBoard]);

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
  }, []);

  const getLegalDestinations = useCallback((square: string): string[] => {
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
  }, [phase]);

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

      // Error — record, undo, stay on same expected move.
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
      };
      const label = labels[verdict.kind] ?? 'Erreur';
      setLastFeedback(label);
      speechService.speak(label, { flush: true });
      return false;
    },
    [phase, expectedIndex, syncBoard, finishSession],
  );

  const useHelp = useCallback(() => {
    if (phase !== 'reconstruction') return;
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
    firstAttemptOkRef.current = sequenceRef.current.map(() => false);
    attemptsRef.current = [];
    setScore(null);
    setPhase('dictation');
    speakSequence(sequenceRef.current, true);
  }, [speakSequence]);

  const generateNewSequence = useCallback(async () => {
    await startSession();
  }, [startSession]);

  const backToSettings = useCallback(() => {
    speechService.stop();
    setPhase('settings');
    setScore(null);
    setLastFeedback(null);
    setRevealedHint(null);
    gameRef.current.reset();
    syncBoard();
  }, [syncBoard]);

  return (
    <BlindSequenceContext.Provider
      value={{
        phase,
        orientation,
        fullMoves,
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
        setOrientation,
        setFullMoves,
        startSession,
        replayDictation,
        startReconstruction,
        getLegalDestinations,
        attemptMove,
        useHelp,
        retrySameSequence,
        generateNewSequence,
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
