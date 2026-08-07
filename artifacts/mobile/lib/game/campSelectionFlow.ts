/**
 * Pure camp-selection → active-game transition (CHOIX DU CAMP).
 * UI layers (BoardCampPicker) call into this after a tap / random press.
 */
import { resolveSideChoice } from './resolveSideChoice.ts';
import type { PlayerColor, SideChoice } from './types.ts';

export type CampSelectionResult = {
  playerColor: PlayerColor;
  /** White at bottom when false; Black at bottom when true. */
  isFlipped: boolean;
  /** After selection the picker overlay must disappear. */
  phase: 'playing';
};

/**
 * Resolve a camp choice and describe the resulting active-game orientation.
 * Random uses the provided RNG (default Math.random).
 */
export function beginGameFromCampChoice(
  side: SideChoice,
  random: () => number = Math.random,
): CampSelectionResult {
  const playerColor = resolveSideChoice(side, random);
  return {
    playerColor,
    isFlipped: playerColor === 'b',
    phase: 'playing',
  };
}
