/**
 * React wrapper around PuzzleSession for visual / blind puzzle modes.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Chess } from 'chess.js';
import type { Move, Square } from 'chess.js';
import { verbalMove } from '@/lib/chessParser';
import { parseChessVoice } from '@/lib/voice';
import type { BoardPiece, LastMove } from '@/contexts/GameContext';
import { speechService } from '@/services/SpeechService';
import { audioSettings } from '@/services/AudioSettings';
import {
  DEFAULT_PUZZLE_FILTERS,
  PuzzleSession,
  PuzzleSolutionReplay,
  narratePosition,
  narratePositionSpoken,
  puzzleHistoryStorage,
  selectPuzzle,
  filterBoardPieces,
  type LocalPuzzle,
  type PuzzleAttemptOutcome,
  type PuzzleAttemptResult,
  type PuzzleAttemptStats,
  type PuzzleFilters,
  type PuzzleOrientation,
  type PuzzlePhase,
  type PuzzleReplayMove,
  type PuzzleSubmode,
  type PieceRevealFilter,
} from '@/lib/puzzles';

export type PuzzleSpokenResult =
  | PuzzleAttemptResult
  | 'command'
  | 'idle';

interface PuzzleContextValue {
  phase: PuzzlePhase;
  submode: PuzzleSubmode | null;
  filters: PuzzleFilters;
  puzzle: LocalPuzzle | null;
  stats: PuzzleAttemptStats | null;
  board: (BoardPiece | null)[][];
  displayBoard: (BoardPiece | null)[][];
  lastMove: LastMove | null;
  orientation: PuzzleOrientation;
  sideToMove: 'w' | 'b';
  boardVisible: boolean;
  pieceRevealFilter: PieceRevealFilter;
  isPreviewing: boolean;
  isReplaying: boolean;
  isSpeaking: boolean;
  lastFeedback: string | null;
  solutionLine: string | null;
  positionNarration: string | null;
  loadError: string | null;
  setFilters: (partial: Partial<PuzzleFilters>) => void;
  selectSubmode: (m: PuzzleSubmode) => void;
  backToHub: () => void;
  startPuzzle: () => Promise<void>;
  nextPuzzle: () => Promise<void>;
  retry: () => void;
  revealSolution: () => void;
  revealWhitePieces: () => void;
  revealBlackPieces: () => void;
  repeatPosition: () => void;
  getLegalDestinations: (square: string) => string[];
  attemptBoardMove: (from: string, to: string) => PuzzleAttemptResult | 'idle';
  applySpokenMove: (raw: string) => PuzzleSpokenResult;
}

const PuzzleContext = createContext<PuzzleContextValue | null>(null);

const PREVIEW_WRONG_MS = 1000;
const PIECE_REVEAL_MS = 5000;

export function PuzzleProvider({ children }: { children: React.ReactNode }) {
  const sessionRef = useRef(new PuzzleSession());
  const replayRef = useRef(new PuzzleSolutionReplay());
  const submodeRef = useRef<PuzzleSubmode | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [phase, setPhase] = useState<PuzzlePhase>('hub');
  const [submode, setSubmode] = useState<PuzzleSubmode | null>(null);
  const [filters, setFiltersState] = useState<PuzzleFilters>({ ...DEFAULT_PUZZLE_FILTERS });
  const [puzzle, setPuzzle] = useState<LocalPuzzle | null>(null);
  const [stats, setStats] = useState<PuzzleAttemptStats | null>(null);
  const [board, setBoard] = useState<(BoardPiece | null)[][]>(() =>
    new Chess().board() as (BoardPiece | null)[][],
  );
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [orientation, setOrientation] = useState<PuzzleOrientation>('w');
  const [sideToMove, setSideToMove] = useState<'w' | 'b'>('w');
  const [boardVisible, setBoardVisible] = useState(true);
  const [pieceRevealFilter, setPieceRevealFilter] = useState<PieceRevealFilter>('all');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [solutionLine, setSolutionLine] = useState<string | null>(null);
  const [positionNarration, setPositionNarration] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const clearPreviewTimer = useCallback(() => {
    if (previewTimerRef.current != null) {
      clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current != null) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const resetPresentation = useCallback(() => {
    clearPreviewTimer();
    clearRevealTimer();
    setIsPreviewing(false);
    setPieceRevealFilter('all');
  }, [clearPreviewTimer, clearRevealTimer]);

  const syncFromSession = useCallback(() => {
    const session = sessionRef.current;
    if (!session.isLoaded) return;
    setBoard(session.getChess().board() as (BoardPiece | null)[][]);
    setSideToMove(session.getSideToMove());
    setOrientation(session.getOrientation());
    setStats(session.getStats());
  }, []);

  const displayBoard = useMemo(() => {
    if (submode === 'blind' && !boardVisible && pieceRevealFilter === 'all') {
      return filterBoardPieces(board, 'hidden');
    }
    if (submode === 'blind' && pieceRevealFilter !== 'all') {
      return filterBoardPieces(board, pieceRevealFilter);
    }
    return board;
  }, [board, submode, boardVisible, pieceRevealFilter]);

  useEffect(() => {
    submodeRef.current = submode;
  }, [submode]);

  useEffect(() => {
    audioSettings.ensureLoaded().catch(() => {});
    const unsub = speechService.onSpeakingChange(setIsSpeaking);
    return () => {
      unsub();
      speechService.stop();
      replayRef.current.cancel();
      clearPreviewTimer();
      clearRevealTimer();
    };
  }, [clearPreviewTimer, clearRevealTimer]);

  const markHelp = useCallback((key: keyof PuzzleAttemptStats['helps']) => {
    const session = sessionRef.current;
    if (!session.isLoaded) return;
    const next = session.getStats();
    if (next.helps[key]) return;
    next.helps[key] = true;
    session.setStats(next);
    setStats(session.getStats());
  }, []);

  const showWrongMovePreview = useCallback(
    (from: string, to: string) => {
      const session = sessionRef.current;
      if (!session.isLoaded) return;
      const clone = new Chess(session.getFen());
      try {
        const played = clone.move({ from, to, promotion: 'q' }) as Move;
        clearPreviewTimer();
        setIsPreviewing(true);
        setBoard(clone.board() as (BoardPiece | null)[][]);
        setLastMove({ from: played.from, to: played.to });
        previewTimerRef.current = setTimeout(() => {
          previewTimerRef.current = null;
          setIsPreviewing(false);
          setLastMove(null);
          syncFromSession();
        }, PREVIEW_WRONG_MS);
      } catch {
        syncFromSession();
      }
    },
    [clearPreviewTimer, syncFromSession],
  );

  const setFilters = useCallback((partial: Partial<PuzzleFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...partial }));
  }, []);

  const selectSubmode = useCallback((m: PuzzleSubmode) => {
    submodeRef.current = m;
    setSubmode(m);
    setBoardVisible(m === 'visual');
    setLastFeedback(null);
    setLoadError(null);
  }, []);

  const backToHub = useCallback(() => {
    speechService.stop();
    replayRef.current.cancel();
    resetPresentation();
    setIsReplaying(false);
    setSubmode(null);
    setPhase('hub');
    setPuzzle(null);
    setStats(null);
    setLastMove(null);
    setLastFeedback(null);
    setSolutionLine(null);
    setPositionNarration(null);
    setLoadError(null);
    setBoardVisible(true);
    setBoard(new Chess().board() as (BoardPiece | null)[][]);
  }, [resetPresentation]);

  const announceBlindPosition = useCallback((fen: string) => {
    const text = narratePosition(fen);
    setPositionNarration(text);
    speechService.speak(narratePositionSpoken(fen), { flush: true, rate: 0.92 });
  }, []);

  const finishSolved = useCallback(() => {
    const finalStats = sessionRef.current.getFinalStats();
    setStats(finalStats);
    setPhase('results');
    setLastFeedback('Problème résolu');
    speechService.speak(
      `Problème résolu. Précision au premier essai : ${finalStats.accuracyPercent} pour cent.`,
      { flush: true },
    );

    const p = sessionRef.current.currentPuzzle;
    if (p) {
      puzzleHistoryStorage
        .appendHistory({
          puzzleId: p.id,
          playedAt: new Date().toISOString(),
          solved: finalStats.solved,
          solvedWithoutHelp: finalStats.solvedWithoutHelp,
          firstAttemptSuccess: finalStats.firstAttemptSuccess,
          wrongChessMoves: finalStats.wrongChessMoves,
          recognitionFailures: finalStats.recognitionFailures,
          solutionRequested: finalStats.solutionRequested,
          themes: p.themes,
          rating: p.rating,
        })
        .catch(() => {});
    }
  }, []);

  const applyOutcome = useCallback(
    (outcome: PuzzleAttemptOutcome, preview?: { from: string; to: string }) => {
      const { result, userMove, opponentMove } = outcome;

      if (result === 'illegal') {
        const msg = 'Coup illégal.';
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        return;
      }
      if (result === 'wrong-legal') {
        const msg = 'Coup incorrect. Réessaie.';
        setLastFeedback(msg);
        speechService.speak(msg, { flush: true });
        if (
          preview &&
          submodeRef.current === 'visual' &&
          !isPreviewing
        ) {
          showWrongMovePreview(preview.from, preview.to);
        } else {
          syncFromSession();
        }
        return;
      }

      syncFromSession();
      if (result === 'correct' || result === 'complete') {
        if (userMove) setLastMove({ from: userMove.from, to: userMove.to });
        setLastFeedback(result === 'complete' ? 'Problème résolu' : 'Correct.');
        if (opponentMove) {
          setLastMove({ from: opponentMove.from, to: opponentMove.to });
          speechService.speak(verbalMove(opponentMove), { flush: false });
        }
        if (result === 'complete') finishSolved();
      }
    },
    [finishSolved, isPreviewing, showWrongMovePreview, syncFromSession],
  );

  const beginPuzzle = useCallback(
    async (chosen: LocalPuzzle) => {
      speechService.stop();
      replayRef.current.cancel();
      resetPresentation();
      setIsReplaying(false);
      setLoadError(null);
      setSolutionLine(null);
      setLastFeedback(null);

      try {
        const snap = sessionRef.current.load(chosen);
        setPuzzle(chosen);
        setLastMove(null);
        syncFromSession();
        setPhase('playing');

        const mode = submodeRef.current;
        if (mode === 'blind') {
          setBoardVisible(false);
          setPieceRevealFilter('hidden');
          announceBlindPosition(snap.startFen);
        } else {
          setBoardVisible(true);
          setPieceRevealFilter('all');
          setPositionNarration(null);
          const turn =
            snap.sideToMove === 'w' ? 'Trait aux Blancs.' : 'Trait aux Noirs.';
          setLastFeedback(turn);
          speechService.speak(turn, { flush: true });
        }

        await puzzleHistoryStorage.pushRecentId(chosen.id);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : String(err));
        setPhase('hub');
      }
    },
    [announceBlindPosition, resetPresentation, syncFromSession],
  );

  const startPuzzle = useCallback(async () => {
    if (!submodeRef.current) return;
    setLoadError(null);
    const recent = await puzzleHistoryStorage.getRecentIds();
    const chosen = selectPuzzle({ filters, excludeIds: recent });
    if (!chosen) {
      setLoadError('Aucun problème ne correspond à ces filtres.');
      return;
    }
    await beginPuzzle(chosen);
  }, [filters, beginPuzzle]);

  const nextPuzzle = useCallback(async () => {
    await startPuzzle();
  }, [startPuzzle]);

  const retry = useCallback(() => {
    const p = sessionRef.current.currentPuzzle;
    if (!p) return;
    speechService.stop();
    replayRef.current.cancel();
    resetPresentation();
    setIsReplaying(false);
    setSolutionLine(null);
    setLastFeedback(null);
    beginPuzzle(p).catch(() => {});
  }, [beginPuzzle, resetPresentation]);

  const repeatPosition = useCallback(() => {
    const session = sessionRef.current;
    if (!session.isLoaded || phase !== 'playing') return;
    markHelp('positionRepeat');
    announceBlindPosition(session.getFen());
    setLastFeedback('Position répétée.');
  }, [announceBlindPosition, markHelp, phase]);

  const startPieceReveal = useCallback(
    (color: 'white' | 'black') => {
      if (submodeRef.current !== 'blind' || phase !== 'playing') return;
      const key = color === 'white' ? 'whiteReveal' : 'blackReveal';
      const session = sessionRef.current;
      if (!session.isLoaded) return;
      const current = session.getStats();
      if (current.helps[key]) return;

      markHelp(key);
      clearRevealTimer();
      setPieceRevealFilter(color);
      revealTimerRef.current = setTimeout(() => {
        revealTimerRef.current = null;
        setPieceRevealFilter('hidden');
      }, PIECE_REVEAL_MS);
    },
    [clearRevealTimer, markHelp, phase],
  );

  const revealWhitePieces = useCallback(() => startPieceReveal('white'), [startPieceReveal]);
  const revealBlackPieces = useCallback(() => startPieceReveal('black'), [startPieceReveal]);

  const revealSolution = useCallback(() => {
    const session = sessionRef.current;
    if (!session.isLoaded) return;
    if (phase !== 'playing' && phase !== 'results') return;

    speechService.stop();
    replayRef.current.cancel();
    resetPresentation();
    markHelp('solution');

    const line = session.requestSolution();
    const fullLine = session.getUserFacingSolutionLine();
    setSolutionLine(fullLine || line);
    setStats(session.getStats());
    setLastFeedback(`Solution :\n${fullLine || line}`);

    session.resetToStart();
    setLastMove(null);
    syncFromSession();
    setBoardVisible(true);
    setPieceRevealFilter('all');
    setPhase('solution-replay');
    setIsReplaying(true);

    const moves = session.buildSolutionReplayMoves();
    const game = session.getChess();

    replayRef.current.start(moves, {
      onMove: (m: PuzzleReplayMove) => {
        try {
          const played = game.move({
            from: m.from,
            to: m.to,
            promotion: m.promotion || 'q',
          }) as Move;
          setLastMove({ from: played.from, to: played.to });
          setBoard(game.board() as (BoardPiece | null)[][]);
          setSideToMove(game.turn());
          speechService.speak(m.verbal, { flush: false });
        } catch {
          /* ignore */
        }
      },
      onComplete: () => {
        setIsReplaying(false);
        setPhase('results');
        setStats(session.getFinalStats());
        setLastFeedback('Solution affichée.');
        const p = session.currentPuzzle;
        if (p) {
          const finalStats = session.getFinalStats();
          puzzleHistoryStorage
            .appendHistory({
              puzzleId: p.id,
              playedAt: new Date().toISOString(),
              solved: false,
              solvedWithoutHelp: false,
              firstAttemptSuccess: false,
              wrongChessMoves: finalStats.wrongChessMoves,
              recognitionFailures: finalStats.recognitionFailures,
              solutionRequested: true,
              themes: p.themes,
              rating: p.rating,
            })
            .catch(() => {});
        }
      },
    });
  }, [markHelp, phase, resetPresentation, syncFromSession]);

  const attemptBoardMove = useCallback(
    (from: string, to: string): PuzzleAttemptResult | 'idle' => {
      if (phase !== 'playing' || isReplaying || isPreviewing) return 'idle';
      const session = sessionRef.current;
      if (!session.isLoaded || session.isComplete()) return 'idle';

      const outcome = session.attemptMove(from, to, 'q');
      applyOutcome(outcome, { from, to });
      return outcome.result;
    },
    [phase, isReplaying, isPreviewing, applyOutcome],
  );

  const applySpokenMove = useCallback(
    (raw: string): PuzzleSpokenResult => {
      if (phase !== 'playing' || isReplaying || isPreviewing) return 'idle';
      const session = sessionRef.current;
      if (!session.isLoaded || session.isComplete()) return 'idle';

      const parsed = parseChessVoice(raw, session.getChess(), { mode: 'puzzle' });

      if (parsed.type === 'command') {
        if (parsed.command === 'solution') {
          revealSolution();
          return 'command';
        }
        if (parsed.command === 'repeat_position') {
          repeatPosition();
          return 'command';
        }
        return 'idle';
      }

      if (parsed.type === 'unrecognized' || parsed.type === 'ambiguous') {
        session.recordRecognitionFailure();
        setStats(session.getStats());
        setLastFeedback(
          parsed.type === 'ambiguous'
            ? 'Ambigu — reformule le coup (non compté comme erreur de coup).'
            : 'Non reconnu — réessaie (non compté comme erreur de coup).',
        );
        return 'recognition-failure';
      }

      if (parsed.type === 'illegal') {
        session.recordRecognitionFailure();
        setStats(session.getStats());
        setLastFeedback(
          `Illégal ici (${parsed.intendedDescription ?? '?'}). Non compté comme erreur de coup.`,
        );
        return 'recognition-failure';
      }

      const outcome = session.attemptFromChessMove(parsed.move);
      if (outcome.result === 'wrong-legal' && submodeRef.current === 'visual') {
        applyOutcome(outcome, { from: parsed.move.from, to: parsed.move.to });
      } else {
        applyOutcome(outcome);
      }
      return outcome.result;
    },
    [phase, isReplaying, isPreviewing, revealSolution, repeatPosition, applyOutcome],
  );

  const getLegalDestinations = useCallback(
    (square: string): string[] => {
      if (phase !== 'playing' || isReplaying || isPreviewing) return [];
      if (submodeRef.current === 'blind' && pieceRevealFilter === 'hidden') return [];
      const game = sessionRef.current.getChess();
      const piece = game.get(square as Square);
      if (!piece || piece.color !== game.turn()) return [];
      try {
        const moves = game.moves({ verbose: true, square: square as Square }) as Move[];
        return [...new Set(moves.map((m) => m.to))];
      } catch {
        return [];
      }
    },
    [phase, isReplaying, isPreviewing, pieceRevealFilter],
  );

  return (
    <PuzzleContext.Provider
      value={{
        phase,
        submode,
        filters,
        puzzle,
        stats,
        board,
        displayBoard,
        lastMove,
        orientation,
        sideToMove,
        boardVisible,
        pieceRevealFilter,
        isPreviewing,
        isReplaying,
        isSpeaking,
        lastFeedback,
        solutionLine,
        positionNarration,
        loadError,
        setFilters,
        selectSubmode,
        backToHub,
        startPuzzle,
        nextPuzzle,
        retry,
        revealSolution,
        revealWhitePieces,
        revealBlackPieces,
        repeatPosition,
        getLegalDestinations,
        attemptBoardMove,
        applySpokenMove,
      }}
    >
      {children}
    </PuzzleContext.Provider>
  );
}

export function usePuzzle(): PuzzleContextValue {
  const ctx = useContext(PuzzleContext);
  if (!ctx) throw new Error('usePuzzle must be used within PuzzleProvider');
  return ctx;
}
