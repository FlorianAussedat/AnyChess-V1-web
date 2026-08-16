/**
 * Central registry of persistent AsyncStorage / KeyValueStorage keys.
 *
 * Feature modules must import keys from here instead of scattering string
 * literals. Document-level versions (e.g. repertoire v2) stay on the payload;
 * app-wide schema versioning lives in `schemaVersion.ts`.
 */

export type StorageKeyMeta = {
  /** Exact on-disk key string. */
  key: string;
  /** Owning feature / domain. */
  feature: string;
  /** Human description of the persisted shape. */
  shape: string;
  /** Document or preference version encoded in the key name, if any. */
  documentVersion?: number;
  /** Whether a payload-level migration path exists. */
  hasDocumentMigration?: boolean;
};

export const StorageKeys = {
  /** App-wide storage schema version stamp (integer string). */
  schemaVersion: {
    key: 'anychess.storage.schemaVersion',
    feature: 'storage',
    shape: 'integer string (CURRENT_STORAGE_SCHEMA_VERSION)',
  },
  repertoires: {
    key: 'anychess.repertoire.v2',
    feature: 'openings/repertoire',
    shape: 'RepertoireStoreSnapshot { version: 2, folders, files }',
    documentVersion: 2,
    hasDocumentMigration: true,
  },
  /** Legacy repertoire blob — read once, migrated to v2, then deleted. */
  repertoiresLegacyV1: {
    key: 'anychess.repertoire.v1',
    feature: 'openings/repertoire',
    shape: 'RepertoireStoreSnapshotV1 { version: 1, folders, files }',
    documentVersion: 1,
    hasDocumentMigration: true,
  },
  puzzleRecent: {
    key: 'anychess.puzzles.recent.v1',
    feature: 'puzzles',
    shape: 'string[] puzzle ids (max 50)',
    documentVersion: 1,
  },
  puzzleHistory: {
    key: 'anychess.puzzles.history.v1',
    feature: 'puzzles',
    shape: 'PuzzleHistoryRecord[] (max 200)',
    documentVersion: 1,
  },
  puzzleStreaks: {
    key: 'anychess.puzzles.streaks.v1',
    feature: 'puzzles',
    shape: 'PuzzleStreakState { currentByBand, bestByBand }',
    documentVersion: 1,
  },
  /**
   * Legacy Nommer le coup buckets by per-question response seconds.
   * Preserved read-only for migration safety; new sessions use moveNamingSession60.
   */
  moveNamingRecords: {
    key: 'anychess.move-naming.records.v1',
    feature: 'visualisation/move-naming',
    shape: 'Record<1..10, number> best scores by response seconds (LEGACY)',
    documentVersion: 1,
  },
  /** Principal Nommer le coup record — best correct answers in 60 seconds. */
  moveNamingSession60: {
    key: 'anychess.move-naming.session60.v1',
    feature: 'visualisation/move-naming',
    shape: '{ best: number }',
    documentVersion: 1,
  },
  /** Principal Jouer le coup record — best correct board moves in 60 seconds. */
  playMoveSession60: {
    key: 'anychess.play-move.session60.v1',
    feature: 'visualisation/play-move',
    shape: '{ best: number }',
    documentVersion: 1,
  },
  /**
   * Mémorisation records — best perfect full-move counts per mode
   * (Écouter puis reconstruire / Regarder puis réciter). Not split by perspective.
   */
  blindMemoryRecords: {
    key: 'anychess.blind.memoryRecords.v1',
    feature: 'blind/memorisation',
    shape: '{ listenReconstruct: number, watchRecite: number }',
    documentVersion: 1,
  },
  continueLineRecent: {
    key: 'anychess.continueLine.recent.v1',
    feature: 'openings/continue-line',
    shape: 'Record<folderId, string[] pathIds>',
    documentVersion: 1,
  },
  mentalRecent: {
    key: 'anychess.mental.recent.v1',
    feature: 'visualisation/mental',
    shape: 'string sequence key (anti-repeat)',
    documentVersion: 1,
  },
  boardCoordinatesVisible: {
    key: 'anychess.board.coordinatesVisible.v1',
    feature: 'preferences',
    shape: "'0' | '1' | 'true' | 'false'",
    documentVersion: 1,
  },
  voiceEnabled: {
    key: 'anychess.audio.voiceEnabled.v1',
    feature: 'preferences/audio',
    shape: "'0' | '1' | 'true' | 'false'",
    documentVersion: 1,
  },
  /** Legacy voice mute key — read-through only, never written. */
  voiceEnabledLegacy: {
    key: 'anychess.audio.soundEnabled.v1',
    feature: 'preferences/audio',
    shape: "'0' | '1' | 'true' | 'false' (legacy)",
    documentVersion: 1,
  },
  /** Local device quality feedback for Culture générale quiz questions. */
  chessCultureFeedback: {
    key: 'anychess.chess-culture.feedback.v1',
    feature: 'chess-culture',
    shape:
      'ChessCultureFeedbackSnapshot { version: 1, questions: Record<questionId, feedback> }',
    documentVersion: 1,
  },
  /**
   * Local-only user profile (pseudo + optional Elo ranges + practice years).
   * No account / cloud — syncable later via stable id + updatedAt.
   */
  userProfile: {
    key: 'anychess.profile.user.v1',
    feature: 'profile',
    shape:
      'UserProfile { version: 1, id, username, rapidRangeId, blitzRangeId, bulletRangeId, chessYears, updatedAt }',
    documentVersion: 1,
  },
  /** Default TTS voice speed (1–10) for exercises that speak moves. */
  defaultVoiceSpeed: {
    key: 'anychess.preferences.defaultVoiceSpeed.v1',
    feature: 'preferences/voice',
    shape: 'integer string 1..10',
    documentVersion: 1,
  },
  /**
   * Unified preferences document (language, notation, voice, coords, speed).
   * Legacy per-key prefs are migrated into this document on first load.
   */
  userPreferences: {
    key: 'anychess.preferences.user.v1',
    feature: 'preferences',
    shape:
      'UserPreferences { version: 1, language, chessNotation, voiceEnabled, coordinatesEnabled, voiceSpeed, updatedAt }',
    documentVersion: 1,
  },
  /** Imported PGN games for Lecteur de parties / Game Reader. */
  gameLibrary: {
    key: 'anychess.gameLibrary.v1',
    feature: 'parties/game-library',
    shape: 'GameLibrarySnapshot { version: 1, games: ImportedChessGame[] (main-line + rawPgn) }',
    documentVersion: 1,
  },
} as const satisfies Record<string, StorageKeyMeta>;

export type StorageKeyId = keyof typeof StorageKeys;

/** Suffix appended when quarantining unreadable payloads (recoverability). */
export const CORRUPT_BACKUP_SUFFIX = '.corrupt';

export function corruptBackupKey(primaryKey: string): string {
  return `${primaryKey}${CORRUPT_BACKUP_SUFFIX}`;
}
