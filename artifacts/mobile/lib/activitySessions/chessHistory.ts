import { Chess } from 'chess.js';
import type { LastMove } from '../game/types.ts';

export function chessFromSanHistory(sans: readonly string[]): Chess | null {
  const game = new Chess();
  for (const san of sans) {
    try {
      game.move(san);
    } catch {
      return null;
    }
  }
  return game;
}

export function lastMoveFromGame(game: Chess): LastMove | null {
  const verbose = game.history({ verbose: true });
  const last = verbose[verbose.length - 1];
  if (!last) return null;
  return { from: last.from, to: last.to };
}
