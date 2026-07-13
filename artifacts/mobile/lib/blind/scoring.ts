/**
 * Classify a reconstruction attempt against the expected sequence move.
 */
import type { Move } from 'chess.js';
import type { BlindErrorKind, BlindSequenceMove } from './types';

export type AttemptVerdict =
  | { ok: true }
  | { ok: false; kind: Exclude<BlindErrorKind, 'help'> };

/**
 * Compare an attempted legal move to the currently expected sequence move.
 *
 * Priority:
 *  1. Exact match (from/to/promotion) → correct
 *  2. Same UCI appears later in the remaining sequence → wrong order
 *  3. Different piece type → wrong piece
 *  4. Same piece (and preferably same origin) but wrong destination → wrong destination
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

  // Wrong order: this exact move appears later (not at index 0 of remaining,
  // which is `expected` itself).
  const later = remainingSequence.slice(1);
  if (later.some((m) => m.uci === attemptedUci || m.san === attempted.san)) {
    return { ok: false, kind: 'wrong-order' };
  }

  if (attempted.piece !== expected.piece) {
    return { ok: false, kind: 'wrong-piece' };
  }

  // Same piece type — destination (or origin) is wrong.
  return { ok: false, kind: 'wrong-destination' };
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
  helpsUsed: number;
} {
  const correctOnFirstAttempt = firstAttemptCorrect.filter(Boolean).length;
  const accuracyPercent =
    totalHalfMoves === 0
      ? 0
      : Math.round((correctOnFirstAttempt / totalHalfMoves) * 100);

  let wrongPiece = 0;
  let wrongDestination = 0;
  let wrongOrder = 0;
  let helpsUsed = 0;
  for (const a of attempts) {
    if (a.kind === 'wrong-piece') wrongPiece += 1;
    else if (a.kind === 'wrong-destination') wrongDestination += 1;
    else if (a.kind === 'wrong-order') wrongOrder += 1;
    else if (a.kind === 'help') helpsUsed += 1;
  }

  return {
    totalHalfMoves,
    correctOnFirstAttempt,
    accuracyPercent,
    wrongPiece,
    wrongDestination,
    wrongOrder,
    helpsUsed,
  };
}
