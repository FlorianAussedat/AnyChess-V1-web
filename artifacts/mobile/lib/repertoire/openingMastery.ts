/**
 * Opening-line mastery — pure rules.
 *
 * Review attempts are the only input. Learning never calls these writers.
 * PGN status is always derived from its current training lines.
 */
import type { ContinueLinePath } from '../continueLine/types.ts';
import type { StoredPgnFile } from './storage/types.ts';

export const OPENING_MASTERY_WINDOW = 5;
export const OPENING_MASTERY_MIN_SUCCESSES = 4;

export type OpeningRevisionResult = 'success' | 'failure';

export type OpeningLearningCategory = 'unmastered' | 'partial' | 'mastered';

export type OpeningLearningFilter = OpeningLearningCategory | 'priority' | 'all';

/** Stable key: file id + ContinueLinePath.id (`${startFen}|${sans}`). */
export function openingLineKey(fileId: string, pathId: string): string {
  return `${fileId}:${pathId}`;
}

export function appendRevisionResult(
  history: readonly OpeningRevisionResult[],
  result: OpeningRevisionResult,
): OpeningRevisionResult[] {
  return [...history, result];
}

export function lastFiveRevisionResults(
  history: readonly OpeningRevisionResult[],
): OpeningRevisionResult[] {
  if (history.length <= OPENING_MASTERY_WINDOW) return [...history];
  return history.slice(-OPENING_MASTERY_WINDOW);
}

export function isOpeningLineMastered(
  history: readonly OpeningRevisionResult[],
): boolean {
  if (history.length < OPENING_MASTERY_WINDOW) return false;
  const lastFive = lastFiveRevisionResults(history);
  const successes = lastFive.filter((x) => x === 'success').length;
  const latest = lastFive[lastFive.length - 1];
  return successes >= OPENING_MASTERY_MIN_SUCCESSES && latest === 'success';
}

export type OpeningPgnMastery = {
  totalLines: number;
  masteredLines: number;
  /** Exact mastered/total in [0, 1]. Zero lines → 0 (never NaN). */
  ratio: number;
  /** Rounded percent for UI (0–100). */
  percentRounded: number;
  category: OpeningLearningCategory;
};

export function getOpeningPgnMastery(masteredLines: number, totalLines: number): OpeningPgnMastery {
  const total = Math.max(0, totalLines);
  const mastered = Math.max(0, Math.min(masteredLines, total));
  const ratio = total === 0 ? 0 : mastered / total;
  return {
    totalLines: total,
    masteredLines: mastered,
    ratio,
    percentRounded: Math.round(ratio * 100),
    category: getOpeningPgnLearningCategory(ratio),
  };
}

/**
 * Categories from the exact ratio (not the rounded percent):
 *  - unmastered: 0 ≤ r < 0.50
 *  - partial:    0.50 ≤ r ≤ 0.95
 *  - mastered:   r > 0.95
 */
export function getOpeningPgnLearningCategory(ratio: number): OpeningLearningCategory {
  if (!Number.isFinite(ratio) || ratio < 0.5) return 'unmastered';
  if (ratio <= 0.95) return 'partial';
  return 'mastered';
}

export function pgnMatchesLearningFilter(
  category: OpeningLearningCategory,
  priority: boolean,
  filter: OpeningLearningFilter,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'priority') return priority;
  return category === filter;
}

export type LearningPgnSortItem = {
  priority: boolean;
  masteryRatio: number;
  sortName: string;
  id: string;
};

/** Priority first, then lowest mastery %, then stable name/id. */
export function compareLearningPgns(a: LearningPgnSortItem, b: LearningPgnSortItem): number {
  if (a.priority !== b.priority) return a.priority ? -1 : 1;
  if (a.masteryRatio !== b.masteryRatio) return a.masteryRatio - b.masteryRatio;
  const byName = a.sortName.localeCompare(b.sortName, 'fr');
  if (byName !== 0) return byName;
  return a.id.localeCompare(b.id);
}

export function sortLearningPgns<T extends LearningPgnSortItem>(items: readonly T[]): T[] {
  return [...items].sort(compareLearningPgns);
}

export function isPgnPriority(file: Pick<StoredPgnFile, 'priority'>): boolean {
  return file.priority === true;
}

export function unmasteredLearningPaths(
  fileId: string,
  paths: readonly ContinueLinePath[],
  historyFor: (key: string) => readonly OpeningRevisionResult[],
): ContinueLinePath[] {
  return paths.filter((path) => !isOpeningLineMastered(historyFor(openingLineKey(fileId, path.id))));
}

export function pickUnmasteredLearningPath(
  fileId: string,
  paths: readonly ContinueLinePath[],
  historyFor: (key: string) => readonly OpeningRevisionResult[],
  rng: () => number = Math.random,
): ContinueLinePath | null {
  const eligible = unmasteredLearningPaths(fileId, paths, historyFor);
  if (eligible.length === 0) return null;
  const index = Math.min(eligible.length - 1, Math.floor(rng() * eligible.length));
  return eligible[index] ?? null;
}
