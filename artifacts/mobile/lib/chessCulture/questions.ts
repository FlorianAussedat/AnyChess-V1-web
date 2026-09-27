/** Curated offline bank: 213 culture questions; see docs/chess-quiz-500.md. */
import type { ChessCultureQuestion } from './types.ts';
import { RETAINED_QUESTIONS as bank0 } from './questions/retained.ts';
import { QUESTIONS as bank1 } from './questions/terminologyReviewed.ts';
import { QUESTIONS as bank3 } from './questions/endgamesReviewed.ts';
import { QUESTIONS as bank4 } from './questions/rulesReviewed.ts';
import { QUESTIONS as bank5 } from './questions/historyExtraReviewed.ts';

export const CHESS_CULTURE_QUESTIONS: ChessCultureQuestion[] = [
  ...bank0,
  ...bank1,
  ...bank3,
  ...bank4,
  ...bank5,
];
