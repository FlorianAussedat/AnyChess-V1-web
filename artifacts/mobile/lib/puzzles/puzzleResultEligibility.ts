/**
 * Pure result / streak / index rules for Problèmes (tactics).
 *
 * Indices (count toward “Indices utilisés” and void clean streak):
 * - Coup suivant — each use (+1)
 * - Afficher les pièces blanches — first use only (+1)
 * - Afficher les pièces noires — first use only (+1)
 *
 * Free (never an index, never voids streak alone):
 * - Répéter la position
 *
 * Full Solution → unsolved (not a clean/assisted solve).
 */
import type { PuzzleAttemptStats, PuzzleHelpUsage } from './types.ts';

export type PuzzleResultState =
  | 'solved'
  | 'solved-with-help'
  | 'unsolved';

/** Helps that count as indices (excludes positionRepeat and solution). */
export function countPuzzleIndices(
  helps: PuzzleHelpUsage,
  nextMoveUses: number,
): number {
  let n = 0;
  if (helps.whiteReveal) n += 1;
  if (helps.blackReveal) n += 1;
  n += Math.max(0, Math.floor(nextMoveUses));
  return n;
}

/** True when any index-type help was used (repeat does not count). */
export function anyPuzzleIndexUsed(
  helps: PuzzleHelpUsage,
  nextMoveUses: number,
): boolean {
  return countPuzzleIndices(helps, nextMoveUses) > 0;
}

/**
 * Clean solve for streak: solved, no solution reveal, no indices,
 * every user move correct on first try.
 */
export function isCleanPuzzleSolve(stats: PuzzleAttemptStats): boolean {
  if (!stats.solved || stats.solutionRequested) return false;
  if (stats.wrongChessMoves > 0) return false;
  if (
    stats.userMoveCount <= 0 ||
    stats.correctOnFirstAttempt !== stats.userMoveCount
  ) {
    return false;
  }
  if (anyPuzzleIndexUsed(stats.helps, stats.nextMoveUses)) return false;
  return true;
}

/** Assisted solve: completed the line without full solution, but used indices or mistakes. */
export function isAssistedPuzzleSolve(stats: PuzzleAttemptStats): boolean {
  return stats.solved && !stats.solutionRequested && !isCleanPuzzleSolve(stats);
}

export function puzzleResultState(stats: PuzzleAttemptStats): PuzzleResultState {
  if (stats.solutionRequested || !stats.solved) return 'unsolved';
  if (isCleanPuzzleSolve(stats)) return 'solved';
  return 'solved-with-help';
}

export function puzzleResultTitle(state: PuzzleResultState): string {
  switch (state) {
    case 'solved':
      return 'Problème résolu';
    case 'solved-with-help':
      return 'Problème résolu avec aide';
    case 'unsolved':
      return 'Problème non résolu';
  }
}
