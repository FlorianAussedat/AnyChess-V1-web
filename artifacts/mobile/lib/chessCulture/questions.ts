/**
 * Canonical Culture générale chess-culture question bank.
 *
 * Modular sources under ./questions/ — do not embed questions in React screens.
 * Stable IDs must not change when only wording is corrected — bump `revision`.
 */
import type { ChessCultureQuestion } from './types.ts';
import { CHECKMATE_QUESTIONS } from './questions/checkmates.ts';
import { LEGACY_CHESS_CULTURE_QUESTIONS } from './questions/legacyBank.ts';
import { MODERN_CHESS_QUESTIONS } from './questions/modernChess.ts';
import { OPENINGS_QUESTIONS } from './questions/openings.ts';
import { RULES_QUESTIONS } from './questions/rules.ts';
import { TERMINOLOGY_QUESTIONS } from './questions/terminology.ts';
import { VISUAL_QUESTIONS } from './questions/visual.ts';

/** Full active bank: legacy FR set + practical/modern expansion modules. */
export const CHESS_CULTURE_QUESTIONS: ChessCultureQuestion[] = [
  ...LEGACY_CHESS_CULTURE_QUESTIONS,
  ...CHECKMATE_QUESTIONS,
  ...TERMINOLOGY_QUESTIONS,
  ...VISUAL_QUESTIONS,
  ...MODERN_CHESS_QUESTIONS,
  ...OPENINGS_QUESTIONS,
  ...RULES_QUESTIONS,
];
