/**
 * React hook wrapping pure game-reader navigation.
 * Optional onFenChange supports a future Stockfish analyser layer.
 *
 * When `autosaveSession` is true, selection/tree/flip/origin changes are
 * debounced into the shared game session. Stockfish UCI ticks must not call
 * into this hook's setters — they won't, since autosave keys off reader state.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  playMoveOnReader as playMoveOnReaderState,
  returnToExplorationOrigin as returnToExplorationOriginState,
} from './explorationMoves.ts';
import {
  createGameReaderState,
  flipBoard as flipBoardState,
  goToEnd as goToEndState,
  goToNext as goToNextState,
  goToNode as goToNodeState,
  goToPly as goToPlyState,
  goToPrevious as goToPreviousState,
  goToStart as goToStartState,
  setBoardFlipped as setBoardFlippedState,
} from './gameReaderState.ts';
import {
  flushSharedGameSession,
  scheduleSaveSharedGameSession,
  type SharedAnalysisCacheSummary,
} from './sharedReaderPosition.ts';
import type {
  GameReaderState,
  ReaderGame,
  ReaderHeaders,
  ReaderMove,
} from './types.ts';

export type UseGameReaderOptions = {
  game: ReaderGame | null;
  initialPly?: number;
  /** Restore a specific tree node (preferred over ply when variations exist). */
  initialNodeId?: string | null;
  initialFlipped?: boolean;
  /** Restore exploration return point ('' = start). */
  initialExplorationOriginNodeId?: string | null;
  /** Fired whenever the displayed FEN changes (Analyseur / Stockfish later). */
  onFenChange?: (fen: string, ply: number, nodeId: string | null) => void;
  /**
   * Debounced durable autosave of selection/tree (not UCI analysis ticks).
   * Pass analysis fields only when the user changes profile / cache summary.
   */
  autosaveSession?: boolean;
  analysisProfileId?: 'fast' | 'normal' | 'deep';
  analysisCacheSummary?: SharedAnalysisCacheSummary;
};

export type GameReaderApi = GameReaderState & {
  headers: ReaderHeaders;
  moves: ReaderMove[];
  goToStart: () => void;
  goToPrevious: () => void;
  goToNext: () => void;
  goToEnd: () => void;
  goToPly: (ply: number) => void;
  goToNode: (nodeId: string | null) => void;
  flipBoard: () => void;
  setBoardFlipped: (flipped: boolean) => void;
  playMove: (from: string, to: string, promotion?: string) => void;
  returnToExplorationOrigin: () => void;
};

const EMPTY_HEADERS: ReaderHeaders = {};

export function useGameReader(
  options: UseGameReaderOptions,
): GameReaderApi | null {
  const {
    game,
    initialPly = 0,
    initialNodeId = null,
    initialFlipped = false,
    initialExplorationOriginNodeId = null,
    onFenChange,
    autosaveSession = false,
    analysisProfileId,
    analysisCacheSummary,
  } = options;
  const [state, setState] = useState<GameReaderState | null>(() => {
    if (!game) return null;
    if (initialNodeId) {
      return createGameReaderState(
        game,
        initialNodeId,
        initialFlipped,
        initialExplorationOriginNodeId,
      );
    }
    return createGameReaderState(
      game,
      initialPly,
      initialFlipped,
      initialExplorationOriginNodeId,
    );
  });
  const onFenChangeRef = useRef(onFenChange);
  onFenChangeRef.current = onFenChange;
  const gameId = game?.id;
  const analysisProfileIdRef = useRef(analysisProfileId);
  analysisProfileIdRef.current = analysisProfileId;
  const analysisCacheSummaryRef = useRef(analysisCacheSummary);
  analysisCacheSummaryRef.current = analysisCacheSummary;

  useEffect(() => {
    if (!game) {
      setState(null);
      return;
    }
    if (initialNodeId) {
      setState(
        createGameReaderState(
          game,
          initialNodeId,
          initialFlipped,
          initialExplorationOriginNodeId,
        ),
      );
    } else {
      setState(
        createGameReaderState(
          game,
          initialPly,
          initialFlipped,
          initialExplorationOriginNodeId,
        ),
      );
    }
  }, [
    gameId,
    game,
    initialPly,
    initialNodeId,
    initialFlipped,
    initialExplorationOriginNodeId,
  ]);

  useEffect(() => {
    if (!state) return;
    onFenChangeRef.current?.(
      state.currentFen,
      state.currentPly,
      state.currentNodeId,
    );
  }, [state?.currentFen, state?.currentPly, state?.currentNodeId]);

  // Autosave selection/tree only — keyed off reader fields, never UCI ticks.
  useEffect(() => {
    if (!autosaveSession || !state) return;
    scheduleSaveSharedGameSession({
      gameId: state.game.id,
      game: state.game,
      currentNodeId: state.currentNodeId,
      activeLineNodeIds: state.activeLineNodeIds,
      boardFlipped: state.boardFlipped,
      explorationOriginNodeId: state.explorationOriginNodeId,
      analysisProfileId: analysisProfileIdRef.current,
      analysisCacheSummary: analysisCacheSummaryRef.current,
    });
  }, [
    autosaveSession,
    state?.game,
    state?.currentNodeId,
    state?.activeLineNodeIds,
    state?.boardFlipped,
    state?.explorationOriginNodeId,
    analysisProfileId,
    analysisCacheSummary,
  ]);

  useEffect(() => {
    if (!autosaveSession) return;
    return () => {
      void flushSharedGameSession();
    };
  }, [autosaveSession]);

  const goToStart = useCallback(() => {
    setState((prev) => (prev ? goToStartState(prev) : prev));
  }, []);
  const goToPrevious = useCallback(() => {
    setState((prev) => (prev ? goToPreviousState(prev) : prev));
  }, []);
  const goToNext = useCallback(() => {
    setState((prev) => (prev ? goToNextState(prev) : prev));
  }, []);
  const goToEnd = useCallback(() => {
    setState((prev) => (prev ? goToEndState(prev) : prev));
  }, []);
  const goToPly = useCallback((ply: number) => {
    setState((prev) => (prev ? goToPlyState(prev, ply) : prev));
  }, []);
  const goToNode = useCallback((nodeId: string | null) => {
    setState((prev) => (prev ? goToNodeState(prev, nodeId) : prev));
  }, []);
  const flipBoard = useCallback(() => {
    setState((prev) => (prev ? flipBoardState(prev) : prev));
  }, []);
  const setBoardFlipped = useCallback((flipped: boolean) => {
    setState((prev) => (prev ? setBoardFlippedState(prev, flipped) : prev));
  }, []);
  const playMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      setState((prev) =>
        prev ? playMoveOnReaderState(prev, from, to, promotion) : prev,
      );
    },
    [],
  );
  const returnToExplorationOrigin = useCallback(() => {
    setState((prev) => (prev ? returnToExplorationOriginState(prev) : prev));
  }, []);

  return useMemo(() => {
    if (!state || !game) return null;
    return {
      ...state,
      headers: game.headers ?? EMPTY_HEADERS,
      moves: game.moves,
      goToStart,
      goToPrevious,
      goToNext,
      goToEnd,
      goToPly,
      goToNode,
      flipBoard,
      setBoardFlipped,
      playMove,
      returnToExplorationOrigin,
    };
  }, [
    state,
    game,
    goToStart,
    goToPrevious,
    goToNext,
    goToEnd,
    goToPly,
    goToNode,
    flipBoard,
    setBoardFlipped,
    playMove,
    returnToExplorationOrigin,
  ]);
}
