/**
 * Central user preferences document (language, notation, voice, coords, speed).
 * Independent from ProfileStore (identity) and records / PGN storage.
 */

export const USER_PREFERENCES_DOCUMENT_VERSION = 1 as const;

export type AppLanguage = 'fr' | 'en';
export type ChessNotation = 'fr' | 'en';

export type UserPreferences = {
  version: typeof USER_PREFERENCES_DOCUMENT_VERSION;
  language: AppLanguage;
  chessNotation: ChessNotation;
  voiceEnabled: boolean;
  coordinatesEnabled: boolean;
  /** Default TTS voice speed 1–10. */
  voiceSpeed: number;
  updatedAt: string;
};

export type UserPreferencesPatch = Partial<{
  language: AppLanguage;
  chessNotation: ChessNotation;
  voiceEnabled: boolean;
  coordinatesEnabled: boolean;
  voiceSpeed: number;
}>;

export const DEFAULT_APP_LANGUAGE: AppLanguage = 'fr';
export const DEFAULT_CHESS_NOTATION: ChessNotation = 'fr';
