/**
 * Central user preferences document (language, notation, voice, coords, pace).
 * Independent from ProfileStore (identity) and records / PGN storage.
 */

import {
  DEFAULT_DICTATION_PACE,
  type DictationPace,
} from './dictationPace.ts';

export const USER_PREFERENCES_DOCUMENT_VERSION = 1 as const;

export type AppLanguage = 'fr' | 'en';
export type ChessNotation = 'fr' | 'en';
/** Shared Classic / endgame input UI mode. */
export type ChessInputMode = 'classic' | 'keypad';

export type { DictationPace };

export type UserPreferences = {
  version: typeof USER_PREFERENCES_DOCUMENT_VERSION;
  language: AppLanguage;
  chessNotation: ChessNotation;
  voiceEnabled: boolean;
  coordinatesEnabled: boolean;
  /**
   * Legacy TTS rate level 1–10 (kept for persistence/compat).
   * Not exposed in Settings UI — rhythm uses dictationPace.
   */
  voiceSpeed: number;
  /** Pause after speech ends before next dictated move. */
  dictationPace: DictationPace;
  /**
   * Default puzzle rating-band id for visual problems
   * (see lib/puzzles/puzzleBands.ts). Session screens may override locally.
   */
  visualProblemDifficulty: string;
  /**
   * Default puzzle rating-band id for blind problems.
   * Independent from visualProblemDifficulty.
   */
  blindProblemDifficulty: string;
  /** Classic (voice+board) vs chess keypad — shared across game modes. */
  chessInputMode: ChessInputMode;
  /**
   * Default Stockfish strength band for Classic and openings-vs-engine
   * (see lib/difficulty/StockfishStrengthBands.ts).
   */
  stockfishStrengthBandId: string;
  updatedAt: string;
};

export type UserPreferencesPatch = Partial<{
  language: AppLanguage;
  chessNotation: ChessNotation;
  voiceEnabled: boolean;
  coordinatesEnabled: boolean;
  voiceSpeed: number;
  dictationPace: DictationPace;
  visualProblemDifficulty: string;
  blindProblemDifficulty: string;
  chessInputMode: ChessInputMode;
  stockfishStrengthBandId: string;
}>;

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'fr';
export const DEFAULT_CHESS_NOTATION: ChessNotation = 'fr';
export { DEFAULT_DICTATION_PACE };
