/**
 * Theme comprehension score (0–10) from recent attempts.
 *
 * Per attempt:
 * - theoretical failure: 0
 * - success > 150% target: 7
 * - success 126–150%: 8
 * - success 101–125%: 9
 * - success ≤ target: 10
 */
import type { AttemptOutcome } from './types.ts';

export type ScoredAttempt = {
  outcome: AttemptOutcome;
  userMoves: number;
  targetUserMoves: number;
  /** Precomputed attempt score when recorded. */
  attemptScore?: number;
};

export function scoreAttempt(input: {
  outcome: AttemptOutcome;
  userMoves: number;
  targetUserMoves: number;
}): number {
  if (input.outcome === 'abandoned' || input.outcome === 'in-progress') {
    return 0;
  }
  if (input.outcome === 'theoretical-loss') {
    return 0;
  }
  const target = Math.max(1, input.targetUserMoves);
  const ratio = input.userMoves / target;
  if (ratio > 1.5) return 7;
  if (ratio >= 1.26) return 8;
  if (ratio >= 1.01) return 9;
  return 10;
}

export function averageComprehensionScore(
  attempts: ScoredAttempt[],
  window = 10,
): { score: number; count: number } {
  const scored = attempts
    .filter((a) => a.outcome === 'success' || a.outcome === 'theoretical-loss')
    .slice(0, window)
    .map((a) => a.attemptScore ?? scoreAttempt(a));
  if (scored.length === 0) return { score: 0, count: 0 };
  const sum = scored.reduce((s, v) => s + v, 0);
  const avg = sum / scored.length;
  return { score: Math.round(avg * 10) / 10, count: scored.length };
}

export function isThemeMastered(score: number): boolean {
  return score >= 10;
}

export function formatComprehensionScore(score: number): string {
  if (Number.isInteger(score)) return `${score}/10`;
  return `${score.toFixed(1).replace('.', ',')}/10`;
}
