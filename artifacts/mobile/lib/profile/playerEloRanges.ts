/**
 * Shared optional Elo range options for the local user profile
 * (Rapid / Blitz / Bullet). Aligns with puzzle band labels where possible.
 */
import { PUZZLE_RATING_BANDS_SELECTABLE } from '../puzzles/puzzleBands.ts';

export interface PlayerEloRange {
  id: string;
  label: string;
}

export const PLAYER_ELO_RANGES: PlayerEloRange[] = [
  { id: 'unrated', label: 'Non classé' },
  { id: 'lt600', label: '<600' },
  ...PUZZLE_RATING_BANDS_SELECTABLE.map((b) => ({ id: b.id, label: b.label })),
];

export const DEFAULT_PLAYER_ELO_RANGE_ID = 'unrated';

export function getPlayerEloRange(id: string | null | undefined): PlayerEloRange {
  if (!id) {
    return PLAYER_ELO_RANGES.find((r) => r.id === DEFAULT_PLAYER_ELO_RANGE_ID)!;
  }
  return (
    PLAYER_ELO_RANGES.find((r) => r.id === id) ??
    PLAYER_ELO_RANGES.find((r) => r.id === DEFAULT_PLAYER_ELO_RANGE_ID)!
  );
}

export function isValidPlayerEloRangeId(id: string | null | undefined): boolean {
  if (id == null) return true;
  return PLAYER_ELO_RANGES.some((r) => r.id === id);
}
