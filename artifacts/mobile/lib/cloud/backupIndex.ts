import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { CLOUD_BACKUP_INDEX_KEY } from './syncableKeys.ts';

export type BackupIndexEntry = {
  key: string;
  ownerId: string;
};

export async function readBackupIndex(storage: KeyValueStorage): Promise<BackupIndexEntry[]> {
  const raw = await storage.getItem(CLOUD_BACKUP_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as BackupIndexEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row) => row && typeof row.key === 'string' && typeof row.ownerId === 'string');
  } catch {
    return [];
  }
}

export async function rememberBackup(
  storage: KeyValueStorage,
  key: string,
  ownerId: string,
): Promise<void> {
  const list = await readBackupIndex(storage);
  list.push({ key, ownerId });
  const trimmed = list.slice(-20);
  await storage.setItem(CLOUD_BACKUP_INDEX_KEY, JSON.stringify(trimmed));
}
