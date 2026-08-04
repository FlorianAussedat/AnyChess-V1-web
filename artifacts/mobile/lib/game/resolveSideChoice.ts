import type { PlayerColor, SideChoice } from './types.ts';

/** Resolve a side-picker choice into a concrete player color. */
export function resolveSideChoice(
  side: SideChoice,
  random: () => number = Math.random,
): PlayerColor {
  if (side === 'random') return random() < 0.5 ? 'w' : 'b';
  return side;
}
