export {
  PreferencesStore,
  preferencesStore,
  defaultUserPreferences,
  mergePreferencesDocument,
} from './PreferencesStore.ts';
export {
  USER_PREFERENCES_DOCUMENT_VERSION,
  DEFAULT_APP_LANGUAGE,
  DEFAULT_CHESS_NOTATION,
  DEFAULT_DICTATION_PACE,
} from './types.ts';
export type {
  AppLanguage,
  ChessNotation,
  DictationPace,
  UserPreferences,
  UserPreferencesPatch,
} from './types.ts';
export {
  DICTATION_PACES,
  DICTATION_PACE_GAP_MS,
  dictationPaceToGapMs,
  isDictationPace,
  DEFAULT_TTS_RATE,
} from './dictationPace.ts';
export {
  DEFAULT_VISUAL_PROBLEM_DIFFICULTY,
  DEFAULT_BLIND_PROBLEM_DIFFICULTY,
  isPuzzleDifficultyBandId,
  normalizePuzzleDifficultyBandId,
} from './puzzleDifficulty.ts';
export { VoiceSpeedSettings, voiceSpeedSettings } from './VoiceSpeedSettings.ts';
