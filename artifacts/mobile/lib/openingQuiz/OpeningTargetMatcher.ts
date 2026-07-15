import type { OpeningTarget } from './OpeningLineBuilder.ts';

export type TargetMatch = { correct: boolean; expectedSan: string | null; complete: boolean };

/**
 * Exact reference-line matching only. Transpositions intentionally are not
 * treated as equal yet; equivalent-position support is a future enhancement.
 */
export function matchOpeningMove(target: OpeningTarget, ply: number, san: string): TargetMatch {
  const expectedSan = target.sans[ply] ?? null;
  const correct = expectedSan === san;
  return { correct, expectedSan, complete: correct && ply + 1 === target.sans.length };
}
