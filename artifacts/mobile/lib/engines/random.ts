/**
 * RandomEngine — the default built-in opponent.
 *
 * Not a real engine: scores moves randomly, biased toward captures and
 * checks.  Easy to beat, but functional and zero-dependency.
 * Replace or extend this with Stockfish when ready.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../engine';

const CAPTURE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9,
};

export class RandomEngine implements ChessEngine {
  async pickMove(game: Chess): Promise<Move | null> {
    const moves = game.moves({ verbose: true }) as Move[];
    if (!moves.length) return null;

    const scored = moves.map(m => {
      let s = Math.random() * 3;
      if (m.captured) s += (CAPTURE_VALUES[m.captured] ?? 0) * 2;
      try {
        const clone = new Chess(game.fen());
        clone.move({ from: m.from, to: m.to, promotion: 'q' });
        if (clone.isCheck()) s += 4;
      } catch { /* ignore */ }
      return { m, s };
    });

    scored.sort((a, b) => b.s - a.s);
    const pool = scored.slice(0, Math.min(5, scored.length));
    return pool[Math.floor(Math.random() * pool.length)].m;
  }
}

/** Singleton — re-used for the lifetime of the app. */
export const randomEngine = new RandomEngine();
