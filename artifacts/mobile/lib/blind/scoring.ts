/**
 * Classify a reconstruction attempt against the expected sequence move.
 */
import type { Move } from 'chess.js';
import type { BlindErrorKind, BlindSequenceMove } from './types';

export type AttemptVerdict =
  | { ok: true }
  | { ok: false; kind: Exclude<BlindErrorKind, 'help' | 'recognition-failure'> };

/**
 * Compare an attempted legal move to the currently expected sequence move.
 */
export function classifyAttempt(
  expected: BlindSequenceMove,
  attempted: Move,
  remainingSequence: BlindSequenceMove[],
): AttemptVerdict {
  const attemptedUci = `${attempted.from}${attempted.to}${attempted.promotion ?? ''}`;
  const expectedUci = expected.uci;

  if (attemptedUci === expectedUci) {
    return { ok: true };
  }

  const later = remainingSequence.slice(1);
  if (later.some((m) => m.uci === attemptedUci || m.san === attempted.san)) {
    return { ok: false, kind: 'wrong-order' };
  }

  if (attempted.piece !== expected.piece) {
    return { ok: false, kind: 'wrong-piece' };
  }

  return { ok: false, kind: 'wrong-destination' };
}

/** Spoken-recitation verdict (simpler taxonomy). */
export function classifySpokenAttempt(
  expected: BlindSequenceMove,
  attempted: Move | null,
  remainingSequence: BlindSequenceMove[],
): AttemptVerdict | { ok: false; kind: 'recognition-failure' } {
  if (!attempted) return { ok: false, kind: 'recognition-failure' };

  const exact = classifyAttempt(expected, attempted, remainingSequence);
  if (exact.ok) return exact;
  if (exact.kind === 'wrong-order') return exact;
  // Bundle piece/destination mismatches as wrong-move for voice mode reporting.
  return { ok: false, kind: 'wrong-move' };
}

export function computeScore(
  totalHalfMoves: number,
  firstAttemptCorrect: boolean[],
  attempts: { kind: BlindErrorKind }[],
): {
  totalHalfMoves: number;
  correctOnFirstAttempt: number;
  accuracyPercent: number;
  wrongPiece: number;
  wrongDestination: number;
  wrongOrder: number;
  wrongMove: number;
  helpsUsed: number;
  recognitionFailures: number;
} {
  const correctOnFirstAttempt = firstAttemptCorrect.filter(Boolean).length;
  const accuracyPercent =
    totalHalfMoves === 0
      ? 0
      : Math.round((correctOnFirstAttempt / totalHalfMoves) * 100);

  let wrongPiece = 0;
  let wrongDestination = 0;
  let wrongOrder = 0;
  let wrongMove = 0;
  let helpsUsed = 0;
  let recognitionFailures = 0;
  for (const a of attempts) {
    if (a.kind === 'wrong-piece') wrongPiece += 1;
    else if (a.kind === 'wrong-destination') wrongDestination += 1;
    else if (a.kind === 'wrong-order') wrongOrder += 1;
    else if (a.kind === 'wrong-move') wrongMove += 1;
    else if (a.kind === 'help') helpsUsed += 1;
    else if (a.kind === 'recognition-failure') recognitionFailures += 1;
  }

  return {
    totalHalfMoves,
    correctOnFirstAttempt,
    accuracyPercent,
    wrongPiece,
    wrongDestination,
    wrongOrder,
    wrongMove,
    helpsUsed,
    recognitionFailures,
  };
}
