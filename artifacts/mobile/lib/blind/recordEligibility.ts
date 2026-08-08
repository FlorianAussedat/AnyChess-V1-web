/**
 * Pure record-eligibility rules for Mémorisation sessions.
 *
 * Record = highest number of full moves completed at 100% accuracy,
 * with zero help, zero skip, and zero mistake.
 * Recognition failures do not disqualify (not memory errors).
 */
import type { BlindAttemptRecord, BlindErrorKind, BlindSubmode } from './types.ts';

/** Attempt kinds that permanently void record eligibility. */
export const BLIND_RECORD_DISQUALIFYING_KINDS: ReadonlySet<BlindErrorKind> = new Set([
  'wrong-piece',
  'wrong-destination',
  'wrong-order',
  'wrong-move',
  'help',
]);

export function isBlindRecordEligible(
  attempts: readonly { kind: BlindErrorKind }[],
): boolean {
  return !attempts.some((a) => BLIND_RECORD_DISQUALIFYING_KINDS.has(a.kind));
}

/** True when every half-move was correct on the first try and still eligible. */
export function isBlindSessionPerfect(
  firstAttemptCorrect: readonly boolean[],
  attempts: readonly { kind: BlindErrorKind }[],
): boolean {
  return (
    firstAttemptCorrect.length > 0 &&
    firstAttemptCorrect.every(Boolean) &&
    isBlindRecordEligible(attempts)
  );
}

/** Full moves from half-move length (White+Black pairs). */
export function blindRecordFullMoves(totalHalfMoves: number): number {
  return Math.max(0, Math.floor(totalHalfMoves / 2));
}

export type BlindRecordEvaluation = {
  eligible: boolean;
  perfect: boolean;
  fullMoves: number;
  isNewRecord: boolean;
  nextBest: number;
};

/**
 * Evaluate whether a finished session should update the mode record.
 * Perspective does not affect the record bucket — only `submode` does.
 */
export function evaluateBlindRecordResult(
  _submode: BlindSubmode,
  totalHalfMoves: number,
  firstAttemptCorrect: readonly boolean[],
  attempts: readonly BlindAttemptRecord[],
  previousBest: number,
): BlindRecordEvaluation {
  const eligible = isBlindRecordEligible(attempts);
  const perfect = isBlindSessionPerfect(firstAttemptCorrect, attempts);
  const fullMoves = blindRecordFullMoves(totalHalfMoves);
  const qualifies = eligible && perfect && fullMoves > 0;
  const isNewRecord = qualifies && fullMoves > previousBest;
  const nextBest = isNewRecord ? fullMoves : previousBest;
  return { eligible, perfect, fullMoves, isNewRecord, nextBest };
}

export const BLIND_RECORD_INELIGIBLE_MESSAGE =
  'Cette séquence ne compte plus pour le record.';
