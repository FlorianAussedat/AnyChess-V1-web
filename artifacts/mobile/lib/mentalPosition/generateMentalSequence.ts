/**
 * Generate opening-like sequences without requiring Stockfish in tests.
 * Prefer Stockfish via ChessEngine when available.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../engine';

export async function generateMentalSequence(options: {
  fullMoves: number;
  engine?: ChessEngine | null;
  previousKey?: string | null;
  rng?: () => number;
}): Promise<{ sans: string[]; key: string }> {
  const half = Math.max(1, options.fullMoves) * 2;
  const rng = options.rng ?? Math.random;

  if (options.engine) {
    try {
      await options.engine.init?.();
      options.engine.newGame?.();
      const game = new Chess();
      const sans: string[] = [];
      for (let i = 0; i < half; i++) {
        if (game.isGameOver()) break;
        let selected: Move | null = null;
        try {
          selected = (await options.engine.pickMove(game)) ?? null;
        } catch {
          selected = null;
        }
        if (!selected) {
          const legal = game.moves({ verbose: true }) as Move[];
          if (!legal.length) break;
          selected = legal[Math.floor(rng() * Math.min(legal.length, 5))];
        }
        const played = game.move({
          from: selected.from,
          to: selected.to,
          promotion: selected.promotion || 'q',
        }) as Move;
        sans.push(played.san);
      }
      const key = sans.join(' ');
      if (!options.previousKey || key !== options.previousKey) {
        return { sans, key };
      }
    } catch {
      // fall through to random
    }
  }

  // Deterministic-ish random legal-move walk (test-friendly, always offline)
  const game = new Chess();
  const sans: string[] = [];
  for (let i = 0; i < half; i++) {
    const legal = game.moves({ verbose: true }) as Move[];
    if (!legal.length) break;
    // Prefer quieter central moves when possible (first few candidates)
    const pick = legal[Math.floor(rng() * Math.min(legal.length, 6))];
    const played = game.move({ from: pick.from, to: pick.to, promotion: pick.promotion || 'q' }) as Move;
    sans.push(played.san);
  }
  return { sans, key: sans.join(' ') };
}
