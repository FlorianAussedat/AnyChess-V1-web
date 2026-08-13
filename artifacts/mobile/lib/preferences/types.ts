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
  updatedAt: string;
};

export type UserPreferencesPatch = Partial<{
  language: AppLanguage;
  chessNotation: ChessNotation;
  voiceEnabled: boolean;
  coordinatesEnabled: boolean;
  voiceSpeed: number;
  dictationPace: DictationPace;
}>;

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'fr';
export const DEFAULT_CHESS_NOTATION: ChessNotation = 'fr';
export { DEFAULT_DICTATION_PACE };
