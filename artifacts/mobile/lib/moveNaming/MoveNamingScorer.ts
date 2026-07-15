import type { MoveNamingOutcome, MoveNamingScore } from './types.ts';

export function emptyMoveNamingScore(): MoveNamingScore {
  return { score: 0, correct: 0, wrong: 0, timeouts: 0, recognitionFailures: 0 };
}

/** Correct answers score +1, wrong answers -1; timing/recognition do not score. */
export function scoreMoveNamingAttempt(
  score: MoveNamingScore,
  outcome: MoveNamingOutcome,
): MoveNamingScore {
  const next = { ...score };
  if (outcome === 'correct') {
    next.score += 1;
    next.correct += 1;
  } else if (outcome === 'wrong') {
    next.score -= 1;
    next.wrong += 1;
  } else if (outcome === 'timeout') {
    next.timeouts += 1;
  } else {
    next.recognitionFailures += 1;
  }
  return next;
}
