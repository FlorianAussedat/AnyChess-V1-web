/**
 * Shared AnyChess difficulty levels (Débutant → Grand-Maître).
 * Used by Quelle ouverture?, Défends la nulle, etc.
 */

export type AnyChessDifficultyId =
  | 'debutant'
  | 'confirme'
  | 'expert'
  | 'grandMaitre';

export const ANYCHESS_DIFFICULTIES: readonly AnyChessDifficultyId[] = [
  'debutant',
  'confirme',
  'expert',
  'grandMaitre',
] as const;

/** Exact source filenames under assets/brand/mascots/difficulty/. */
export const DIFFICULTY_ASSET_FILES: Record<AnyChessDifficultyId, string> = {
  debutant: 'debutant.png',
  confirme: 'confirme.png',
  expert: 'expert.png',
  grandMaitre: 'GM.png',
};

export function isAnyChessDifficultyId(value: unknown): value is AnyChessDifficultyId {
  return (
    value === 'debutant' ||
    value === 'confirme' ||
    value === 'expert' ||
    value === 'grandMaitre'
  );
}
