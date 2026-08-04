import type { Chess, Move, Square } from 'chess.js';
import type { PlayerColor } from './types.ts';

/** Legal destination squares for the player's piece on `square`, or [] if not their turn piece. */
export function legalDestinationsForSquare(
  game: Chess,
  square: string,
  playerColor: PlayerColor,
  opts: { waitingForUser: boolean },
): string[] {
  if (!opts.waitingForUser || game.isGameOver()) return [];
  const piece = game.get(square as Square);
  if (!piece || piece.color !== playerColor) return [];
  try {
    const moves = game.moves({ verbose: true, square: square as Square }) as Move[];
    return [...new Set(moves.map((m) => m.to))];
  } catch {
    return [];
  }
}
