/**
 * React hook wrapping pure game-reader navigation.
 * Optional onFenChange supports a future Stockfish analyser layer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Fired whenever the displayed FEN changes (Analyseur / Stockfish later). */
  onFenChange?: (fen: string, ply: number, nodeId: string | null) => void;
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
    onFenChange,
  } = options;
  const [state, setState] = useState<GameReaderState | null>(() => {
    if (!game) return null;
    if (initialNodeId) {
      return createGameReaderState(game, initialNodeId, initialFlipped);
    }
    return createGameReaderState(game, initialPly, initialFlipped);
  });
  const onFenChangeRef = useRef(onFenChange);
  onFenChangeRef.current = onFenChange;
  const gameId = game?.id;

  useEffect(() => {
    if (!game) {
      setState(null);
      return;
    }
    if (initialNodeId) {
      setState(createGameReaderState(game, initialNodeId, initialFlipped));
    } else {
      setState(createGameReaderState(game, initialPly, initialFlipped));
    }
  }, [gameId, game, initialPly, initialNodeId, initialFlipped]);

  useEffect(() => {
    if (!state) return;
    onFenChangeRef.current?.(
      state.currentFen,
      state.currentPly,
      state.currentNodeId,
    );
  }, [state?.currentFen, state?.currentPly, state?.currentNodeId]);

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
  ]);
}
