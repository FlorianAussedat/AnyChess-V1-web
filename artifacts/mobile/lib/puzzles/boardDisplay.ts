/**
 * Presentation-only board piece filter for blind tactics help.
 * Does not mutate session FEN / puzzle state.
 */

export type PieceRevealFilter = 'all' | 'white' | 'black' | 'hidden';

/** Presentation-only filter — does not mutate session FEN. */
export function filterBoardPieces<T extends { color: 'w' | 'b' }>(
  board: (T | null)[][],
  filter: PieceRevealFilter,
): (T | null)[][] {
  if (filter === 'all') return board;
  return board.map((row) =>
    row.map((piece) => {
      if (!piece) return null;
      if (filter === 'hidden') return null;
      if (filter === 'white' && piece.color === 'w') return piece;
      if (filter === 'black' && piece.color === 'b') return piece;
      return null;
    }),
  );
}
