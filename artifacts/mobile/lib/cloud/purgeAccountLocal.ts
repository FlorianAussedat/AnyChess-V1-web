import { clearAvatarCache, clearPendingAvatar } from '../profile/avatarLocal.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { readBackupIndex } from './backupIndex.ts';
import {
  ACCOUNT_DELETION_PENDING_KEY,
  CLOUD_BACKUP_INDEX_KEY,
  CLOUD_LAST_BACKUP_KEY,
  cloudWorkspaceKey,
} from './syncableKeys.ts';

export type DeletionPending = {
  userId: string;
  email: string;
};

/**
 * Remove parked workspaces, backups, and avatar cache that belong to one
 * account. Guest and other owners stay on the device.
 */
export async function purgeAccountOwnedKeys(
  storage: KeyValueStorage,
  userId: string,
): Promise<void> {
  await storage.removeItem(cloudWorkspaceKey(userId));
  await clearAvatarCache(storage, userId);
  await clearPendingAvatar(storage);

  const index = await readBackupIndex(storage);
  const kept: typeof index = [];
  for (const row of index) {
    if (row.ownerId === userId) await storage.removeItem(row.key);
    else kept.push(row);
  }
  if (kept.length) await storage.setItem(CLOUD_BACKUP_INDEX_KEY, JSON.stringify(kept));
  else await storage.removeItem(CLOUD_BACKUP_INDEX_KEY);

  const lastKey = await storage.getItem(CLOUD_LAST_BACKUP_KEY);
  if (lastKey) {
    const raw = await storage.getItem(lastKey);
    let ownerId: string | null = null;
    if (raw) {
      try {
        ownerId = (JSON.parse(raw) as { ownerId?: string }).ownerId ?? null;
      } catch {
        ownerId = null;
      }
    }
    if (ownerId === userId) {
      await storage.removeItem(lastKey);
      await storage.removeItem(CLOUD_LAST_BACKUP_KEY);
    }
  }
}

export async function writeDeletionPending(
  storage: KeyValueStorage,
  pending: DeletionPending,
): Promise<void> {
  await storage.setItem(ACCOUNT_DELETION_PENDING_KEY, JSON.stringify(pending));
}

export async function readDeletionPending(
  storage: KeyValueStorage,
): Promise<DeletionPending | null> {
  const raw = await storage.getItem(ACCOUNT_DELETION_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DeletionPending;
    if (!parsed?.userId || typeof parsed.email !== 'string') return null;
    return { userId: parsed.userId, email: parsed.email };
  } catch {
    return null;
  }
}

export async function clearDeletionPending(storage: KeyValueStorage): Promise<void> {
  await storage.removeItem(ACCOUNT_DELETION_PENDING_KEY);
}
