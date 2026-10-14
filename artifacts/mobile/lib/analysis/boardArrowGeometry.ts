/**
 * Screen segment for one UCI arrow. Square names stay algebraic;
 * `flipped` only changes the drawing, never the move.
 */
export type ArrowSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

function squareIndex(square: string): { file: number; rank: number } | null {
  if (square.length < 2) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  if (!Number.isInteger(file) || file < 0 || file > 7) return null;
  if (!Number.isInteger(rank) || rank < 1 || rank > 8) return null;
  return { file, rank };
}

export function arrowSegment(
  from: string,
  to: string,
  options: { flipped: boolean; cellSize: number },
): ArrowSegment | null {
  const a = squareIndex(from);
  const b = squareIndex(to);
  if (!a || !b || !Number.isFinite(options.cellSize) || options.cellSize <= 0) {
    return null;
  }
  const fromCol = options.flipped ? 7 - a.file : a.file;
  const fromRow = options.flipped ? a.rank - 1 : 8 - a.rank;
  const toCol = options.flipped ? 7 - b.file : b.file;
  const toRow = options.flipped ? b.rank - 1 : 8 - b.rank;
  return {
    x1: (fromCol + 0.5) * options.cellSize,
    y1: (fromRow + 0.5) * options.cellSize,
    x2: (toCol + 0.5) * options.cellSize,
    y2: (toRow + 0.5) * options.cellSize,
  };
}
