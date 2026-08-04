import type { PlayMoveOutcome, PlayMoveScore } from './types.ts';

export function emptyPlayMoveScore(): PlayMoveScore {
  return { score: 0, correct: 0, wrong: 0 };
}

export function scorePlayMoveAttempt(
  score: PlayMoveScore,
  outcome: PlayMoveOutcome,
): PlayMoveScore {
  const next = { ...score };
  if (outcome === 'correct') {
    next.score += 1;
    next.correct += 1;
  } else {
    next.wrong += 1;
  }
  return next;
}
