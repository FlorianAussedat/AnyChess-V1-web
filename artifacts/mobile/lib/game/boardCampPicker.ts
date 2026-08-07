/**
 * Pure helpers for board-based camp selection (CHOIX DU CAMP).
 */
import type { BoardPiece, PlayerColor } from '../game/types.ts';

/** Starting FEN — used to render the pre-game camp board. */
export const CAMP_PICKER_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Map a tap on a occupied square to a camp.
 * Empty squares do not select a side.
 */
export function campFromSquareTap(
  board: (BoardPiece | null)[][],
  square: string,
): PlayerColor | null {
  if (!/^[a-h][1-8]$/.test(square)) return null;
  const file = square.charCodeAt(0) - 97;
  const rank = parseInt(square[1]!, 10);
  const row = 8 - rank;
  const piece = board[row]?.[file] ?? null;
  if (!piece) return null;
  return piece.color === 'w' ? 'w' : 'b';
}
