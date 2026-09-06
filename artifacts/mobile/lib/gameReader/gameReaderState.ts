/**
 * Pure navigation helpers for the shared game reader.
 */
import type {
  GameReaderState,
  ReaderColor,
  ReaderGame,
  ReaderMove,
} from './types.ts';

function sideFromFen(fen: string): ReaderColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function clampReaderPly(game: ReaderGame, ply: number): number {
  const total = game.moves.length;
  if (!Number.isFinite(ply)) return 0;
  return Math.max(0, Math.min(Math.floor(ply), total));
}

export function fenAtReaderPly(game: ReaderGame, ply: number): string {
  const safe = clampReaderPly(game, ply);
  if (safe <= 0) return game.initialFen;
  return game.moves[safe - 1]?.fenAfter ?? game.initialFen;
}

export function moveAtReaderPly(
  game: ReaderGame,
  ply: number,
): ReaderMove | null {
  if (ply < 1 || ply > game.moves.length) return null;
  return game.moves[ply - 1] ?? null;
}

export function lastMoveSquaresAtPly(
  game: ReaderGame,
  ply: number,
): { from: string; to: string } | null {
  const move = moveAtReaderPly(game, ply);
  if (!move?.from || !move?.to) return null;
  return { from: move.from, to: move.to };
}

export function createGameReaderState(
  game: ReaderGame,
  ply = 0,
  boardFlipped = false,
): GameReaderState {
  const currentPly = clampReaderPly(game, ply);
  const totalPly = game.moves.length;
  const currentFen = fenAtReaderPly(game, currentPly);
  const currentMove = moveAtReaderPly(game, currentPly);
  const previousMove = moveAtReaderPly(game, currentPly - 1);
  const nextMove = moveAtReaderPly(game, currentPly + 1);
  return {
    game,
    currentPly,
    totalPly,
    currentFen,
    currentMove,
    previousMove,
    nextMove,
    currentSan: currentMove?.san ?? null,
    currentMoveNumber: currentMove?.moveNumber ?? null,
    sideToMove: sideFromFen(currentFen),
    lastMoveSquares: lastMoveSquaresAtPly(game, currentPly),
    canGoBack: currentPly > 0,
    canGoForward: currentPly < totalPly,
    boardFlipped,
  };
}

export function goToStart(state: GameReaderState): GameReaderState {
  return createGameReaderState(state.game, 0, state.boardFlipped);
}

export function goToEnd(state: GameReaderState): GameReaderState {
  return createGameReaderState(
    state.game,
    state.game.moves.length,
    state.boardFlipped,
  );
}

export function goToPrevious(state: GameReaderState): GameReaderState {
  return createGameReaderState(
    state.game,
    state.currentPly - 1,
    state.boardFlipped,
  );
}

export function goToNext(state: GameReaderState): GameReaderState {
  return createGameReaderState(
    state.game,
    state.currentPly + 1,
    state.boardFlipped,
  );
}

export function goToPly(state: GameReaderState, ply: number): GameReaderState {
  return createGameReaderState(state.game, ply, state.boardFlipped);
}

export function flipBoard(state: GameReaderState): GameReaderState {
  return createGameReaderState(
    state.game,
    state.currentPly,
    !state.boardFlipped,
  );
}

export function setBoardFlipped(
  state: GameReaderState,
  flipped: boolean,
): GameReaderState {
  return createGameReaderState(state.game, state.currentPly, flipped);
}
