/**
 * Pedagogical grade family. Not every theme is a mate-distance exercise.
 */
import type { TheoreticalObjective, TheoreticalThemeId } from './types.ts';

export type GradeFamily = 'elementary-mate' | 'pawn-win' | 'defense';

const MATE_THEMES: ReadonlySet<TheoreticalThemeId> = new Set([
  'queen-mate',
  'rook-mate',
  'two-bishops-mate',
]);

export function gradeFamilyFor(
  themeId: TheoreticalThemeId | string,
  objective: TheoreticalObjective,
): GradeFamily {
  if (objective === 'DRAW') return 'defense';
  if (MATE_THEMES.has(themeId as TheoreticalThemeId)) return 'elementary-mate';
  return 'pawn-win';
}
