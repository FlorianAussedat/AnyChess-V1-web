import type { PlayerColor } from '../game/types.ts';
import { tMsg } from '../i18n/tMsg.ts';

/**
 * Board viewpoint for Nommer le coup (display only).
 * Independent of whose turn it is / who just moved.
 */
export type BoardPerspective = PlayerColor;

export function boardPerspectiveLabel(perspective: BoardPerspective): string {
  return perspective === 'w'
    ? tMsg('game.perspectiveWhite')
    : tMsg('game.perspectiveBlack');
}

export function isFlippedForPerspective(perspective: BoardPerspective): boolean {
  return perspective === 'b';
}

/**
 * Prefer alternating perspectives (~65%) to avoid long same-side streaks.
 * Otherwise ~50/50. Session-local only — no persistent storage.
 */
export function pickBoardPerspective(
  previous?: BoardPerspective,
  rng: () => number = Math.random,
): BoardPerspective {
  if (previous != null && rng() < 0.65) {
    return previous === 'w' ? 'b' : 'w';
  }
  return rng() < 0.5 ? 'w' : 'b';
}
