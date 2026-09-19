/** Curated offline bank: 500 questions; see docs/chess-quiz-500.md for review and provenance. */
import type { ChessCultureQuestion } from './types.ts';
import { RETAINED_QUESTIONS as bank0 } from './questions/retained.ts';
import { QUESTIONS as bank1 } from './questions/terminologyReviewed.ts';
import { QUESTIONS as bank2 } from './questions/strategyReviewed.ts';
import { QUESTIONS as bank3 } from './questions/endgamesReviewed.ts';
import { QUESTIONS as bank4 } from './questions/rulesReviewed.ts';
import { QUESTIONS as bank5 } from './questions/historyExtraReviewed.ts';
import { QUESTIONS as bank6 } from './questions/openingPlansReviewed.ts';
import { QUESTIONS as bank7 } from './questions/openingBoards.ts';
import { QUESTIONS as bank8 } from './questions/tacticalBoards.ts';

export const CHESS_CULTURE_QUESTIONS: ChessCultureQuestion[] = [
  ...bank0,
  ...bank1,
  ...bank2,
  ...bank3,
  ...bank4,
  ...bank5,
  ...bank6,
  ...bank7,
  ...bank8,
];

