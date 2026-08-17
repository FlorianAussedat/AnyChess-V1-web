/**
 * Internal taxonomy for Défends la nulle.
 * Used to build a mixed pool — not shown as a catalogue in the UI.
 *
 * Difficulty IDs match the rest of AnyChess (`debutant` … `grandMaitre`).
 * English aliases (`beginner` … `grandmaster`) are accepted at the API edge.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';

export type DefendDrawDifficulty = AnyChessDifficultyId;

/** English aliases from the product brief — map onto AnyChess IDs. */
export type DefendDrawDifficultyAlias =
  | 'beginner'
  | 'confirmed'
  | 'expert'
  | 'grandmaster';

export type EndgameFamily =
  | 'pawn'
  | 'rook'
  | 'queen'
  | 'minor-piece'
  | 'fortress'
  | 'imbalanced';

export type EndgameConcept =
  | 'square-of-pawn'
  | 'opposition'
  | 'distant-opposition'
  | 'zugzwang'
  | 'rook-activity'
  | 'perpetual-check'
  | 'fortress'
  | 'promotion-race'
  | 'king-activity'
  | 'accurate-defense';

export const ENDGAME_FAMILIES: readonly EndgameFamily[] = [
  'pawn',
  'rook',
  'queen',
  'minor-piece',
  'fortress',
  'imbalanced',
] as const;

export const ENDGAME_CONCEPTS: readonly EndgameConcept[] = [
  'square-of-pawn',
  'opposition',
  'distant-opposition',
  'zugzwang',
  'rook-activity',
  'perpetual-check',
  'fortress',
  'promotion-race',
  'king-activity',
  'accurate-defense',
] as const;

export const DEFEND_DRAW_DIFFICULTIES: readonly DefendDrawDifficulty[] = [
  'debutant',
  'confirme',
  'expert',
  'grandMaitre',
] as const;

const ALIAS_TO_ID: Record<DefendDrawDifficultyAlias, DefendDrawDifficulty> = {
  beginner: 'debutant',
  confirmed: 'confirme',
  expert: 'expert',
  grandmaster: 'grandMaitre',
};

export function resolveDefendDrawDifficulty(
  value: DefendDrawDifficulty | DefendDrawDifficultyAlias,
): DefendDrawDifficulty {
  if (
    value === 'debutant' ||
    value === 'confirme' ||
    value === 'expert' ||
    value === 'grandMaitre'
  ) {
    return value;
  }
  return ALIAS_TO_ID[value];
}

export type DifficultyMetrics = {
  legalMoves?: number;
  drawingMoves?: number;
  losingMoves?: number;
  drawingRatio?: number;
  /** How many successive defender plies have ≤2 drawing replies (Syzygy walk). */
  criticalMoves?: number;
  /** Moments along the analyzed PV where exactly one move holds the draw. */
  uniqueMoveMoments?: number;
};

export type DefendDrawSource = {
  type: 'theoretical' | 'master-game';
  white?: string;
  black?: string;
  event?: string;
  year?: number;
  move?: number;
};

export function isEndgameFamily(value: unknown): value is EndgameFamily {
  return (
    typeof value === 'string' &&
    (ENDGAME_FAMILIES as readonly string[]).includes(value)
  );
}

export function isEndgameConcept(value: unknown): value is EndgameConcept {
  return (
    typeof value === 'string' &&
    (ENDGAME_CONCEPTS as readonly string[]).includes(value)
  );
}
