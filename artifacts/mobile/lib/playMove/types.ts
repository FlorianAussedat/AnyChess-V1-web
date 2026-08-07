import type { MoveNamingChallenge } from '../moveNaming/types.ts';

/**
 * Play-the-move reuses the same puzzle-derived challenge shape as Nommer le coup.
 * Board starts at initialFen; player must execute setupMove.
 */
export type PlayMoveChallenge = MoveNamingChallenge & {
  /** French verbal prompt for display / TTS (e.g. "Cavalier f 6"). */
  promptVerbal: string;
};

export type PlayMoveOutcome = 'correct' | 'wrong';

export type PlayMoveScore = {
  score: number;
  correct: number;
  wrong: number;
};
