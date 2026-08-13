/**
 * Puzzle difficulty preference helpers — band ids shared with puzzleBands.
 */
import {
  DEFAULT_PUZZLE_RATING_BAND_ID,
  PUZZLE_RATING_BANDS,
} from '../puzzles/puzzleBands.ts';

export const DEFAULT_VISUAL_PROBLEM_DIFFICULTY = DEFAULT_PUZZLE_RATING_BAND_ID;
export const DEFAULT_BLIND_PROBLEM_DIFFICULTY = DEFAULT_PUZZLE_RATING_BAND_ID;

export function isPuzzleDifficultyBandId(value: unknown): value is string {
  return typeof value === 'string' && PUZZLE_RATING_BANDS.some((b) => b.id === value);
}

export function normalizePuzzleDifficultyBandId(
  value: unknown,
  fallback: string = DEFAULT_PUZZLE_RATING_BAND_ID,
): string {
  return isPuzzleDifficultyBandId(value) ? value : fallback;
}
