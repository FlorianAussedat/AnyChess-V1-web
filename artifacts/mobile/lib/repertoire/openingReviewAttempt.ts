/**
 * Per-attempt Review counters for a theoretical line.
 *
 * Only the reviewed side's moves count. Opponent book replies are ignored.
 * Errors and reveals are stored by ply so undo cannot erase them, and several
 * wrong tries on the same move still count as one error-move.
 */
import type { OpeningRevisionResult } from './openingMastery.ts';

export type ReviewSide = 'w' | 'b';

export type OpeningReviewAttemptSnapshot = {
  userMovesToFind: number;
  errorMoveCount: number;
  revealedMoveCount: number;
  revealedContinuation: boolean;
  isSuccess: boolean;
};

export function countUserMovesToFind(
  pathSans: readonly string[],
  side: ReviewSide,
): number {
  return pathSans.filter((_, index) =>
    side === 'w' ? index % 2 === 0 : index % 2 === 1,
  ).length;
}

export function emptyReviewAttemptSnapshot(
  userMovesToFind = 0,
): OpeningReviewAttemptSnapshot {
  return {
    userMovesToFind,
    errorMoveCount: 0,
    revealedMoveCount: 0,
    revealedContinuation: false,
    isSuccess: userMovesToFind >= 0,
  };
}

export class OpeningReviewAttempt {
  private readonly errorPlies = new Set<number>();
  private readonly revealedPlies = new Set<number>();
  private revealedContinuation = false;
  readonly userMovesToFind: number;

  constructor(userMovesToFind: number) {
    this.userMovesToFind = userMovesToFind;
  }

  markError(ply: number): void {
    this.errorPlies.add(ply);
  }

  markReveal(ply: number): void {
    this.revealedPlies.add(ply);
  }

  markContinuationRevealed(): void {
    this.revealedContinuation = true;
  }

  snapshot(): OpeningReviewAttemptSnapshot {
    const errorMoveCount = this.errorPlies.size;
    const revealedMoveCount = this.revealedPlies.size;
    return {
      userMovesToFind: this.userMovesToFind,
      errorMoveCount,
      revealedMoveCount,
      revealedContinuation: this.revealedContinuation,
      isSuccess:
        errorMoveCount === 0 &&
        revealedMoveCount === 0 &&
        !this.revealedContinuation,
    };
  }
}

export function reviewResultFromAttempt(
  snap: OpeningReviewAttemptSnapshot,
): OpeningRevisionResult {
  return snap.isSuccess ? 'success' : 'failure';
}
