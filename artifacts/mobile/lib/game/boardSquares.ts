/**
 * Algebraic squares vs display indices on the 8×8 board.
 * Independent of React / pointer handling — used by ChessBoard and tests.
 */

export const BOARD_FILES = 'abcdefgh';

/** File 0=a … 7=h, rankFromTopWhite 0=rank 8 … 7=rank 1. */
export function squareFromBoardIndices(
  file: number,
  rankFromTopWhite: number,
): string {
  return `${BOARD_FILES[file]}${8 - rankFromTopWhite}`;
}

export function boardDisplayOrder(flipped: boolean): {
  rows: number[];
  cols: number[];
} {
  const forward = [0, 1, 2, 3, 4, 5, 6, 7];
  if (!flipped) return { rows: forward, cols: forward };
  const reverse = [7, 6, 5, 4, 3, 2, 1, 0];
  return { rows: reverse, cols: reverse };
}

/**
 * Map a visible cell (0,0 = top-left) to an algebraic square.
 * Flip puts Black's pieces at the bottom (h1 at top-left).
 */
export function displayCellToSquare(
  displayRow: number,
  displayCol: number,
  flipped: boolean,
): string {
  const { rows, cols } = boardDisplayOrder(flipped);
  return squareFromBoardIndices(cols[displayCol]!, rows[displayRow]!);
}
