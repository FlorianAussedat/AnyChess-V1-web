import type { BoardPerspective } from './boardPerspective.ts';

export type MoveNamingOutcome = 'correct' | 'wrong' | 'timeout' | 'recognition-failure';

export type MoveNamingChallenge = {
  puzzleId: string;
  initialFen: string;
  positionFen: string;
  setupSan: string;
  setupMove: { from: string; to: string; promotion?: string };
  expectedSan: string;
  /** Display viewpoint only — does not affect answer validation. */
  boardPerspective: BoardPerspective;
};

export type MoveNamingScore = {
  score: number;
  correct: number;
  wrong: number;
  timeouts: number;
  recognitionFailures: number;
};
