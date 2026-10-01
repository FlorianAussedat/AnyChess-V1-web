import { StorageKeys } from '../storage/StorageKeys.ts';

/**
 * User-owned documents that follow a device across sign-in.
 * Ephemeral sessions (lecteur en cours, activités ouvertes) stay local.
 */
export const SYNCABLE_STORAGE_KEYS = [
  StorageKeys.repertoires.key,
  StorageKeys.gameLibrary.key,
  StorageKeys.pgnCommentTranslations.key,
  StorageKeys.pgnTranslationQueue.key,
  StorageKeys.openingLineMastery.key,
  StorageKeys.userPreferences.key,
  StorageKeys.userProfile.key,
  StorageKeys.openingQuizRecords.key,
  StorageKeys.moveNamingSession60.key,
  StorageKeys.playMoveSession60.key,
  StorageKeys.blindMemoryRecords.key,
  StorageKeys.puzzleHistory.key,
  StorageKeys.puzzleStreaks.key,
  StorageKeys.chessCultureHistory.key,
  StorageKeys.chessCultureFeedback.key,
  StorageKeys.endgameTrainingV2.key,
  StorageKeys.theoreticalEndgameV2.key,
  StorageKeys.continueLineRecent.key,
] as const;

export type SyncableStorageKey = (typeof SYNCABLE_STORAGE_KEYS)[number];

export function isSyncableStorageKey(key: string): key is SyncableStorageKey {
  return (SYNCABLE_STORAGE_KEYS as readonly string[]).includes(key);
}

export const CLOUD_ACTIVE_USER_KEY = 'anychess.cloud.activeUser.v1';
export const CLOUD_SESSION_KEY = 'anychess.cloud.session.v1';
export const CLOUD_LAST_BACKUP_KEY = 'anychess.cloud.lastBackup.v1';
export const CLOUD_BACKUP_INDEX_KEY = 'anychess.cloud.backup.index.v1';
export const ACCOUNT_DELETION_PENDING_KEY = 'anychess.account.deletion.pending.v1';
export const CLOUD_STATUS_KEY = 'anychess.cloud.status.v1';

export function cloudWorkspaceKey(ownerId: string): string {
  return `anychess.cloud.workspace.${ownerId}.v1`;
}

export function cloudBackupKey(stamp: string): string {
  return `anychess.cloud.backup.${stamp}.v1`;
}

export const GUEST_OWNER_ID = 'guest';
