/**
 * If native Stockfish `init()` fails (no module, spawn error), keep playing
 * with a fallback ChessEngine (RandomEngine). Does not change UCI or Elo.
 */
import type { Chess } from 'chess.js';
import type { ChessEngine } from '../engine.ts';

export function withInitFallback(
  primary: ChessEngine,
  fallback: ChessEngine,
): ChessEngine {
  let settled = false;
  let useFallback = false;

  const settle = async () => {
    if (settled) return;
    try {
      await primary.init?.();
    } catch {
      useFallback = true;
      try {
        primary.destroy?.();
      } catch {
        /* ignore */
      }
    }
    settled = true;
  };

  const active = () => (useFallback ? fallback : primary);

  return {
    async init() {
      await settle();
    },

    async pickMove(game: Chess) {
      await settle();
      return active().pickMove(game);
    },

    cancel() {
      active().cancel?.();
    },

    newGame() {
      if (!useFallback) return primary.newGame?.();
    },

    applyStrength(options) {
      if (useFallback) return;
      return primary.applyStrength?.(options);
    },

    destroy() {
      try {
        primary.destroy?.();
      } catch {
        /* ignore */
      }
    },
  };
}
