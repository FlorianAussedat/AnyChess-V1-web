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
  if (storage.updateItem) {
    await storage.updateItem(CLOUD_BACKUP_INDEX_KEY, raw => {
      let list: BackupIndexEntry[] = [];
      try { const parsed = JSON.parse(raw ?? '[]'); if (Array.isArray(parsed)) list = parsed; } catch { /* keep backup bytes */ }
      if (!list.some(row => row.key === key)) list.push({ key, ownerId });
      return JSON.stringify(list);
    });
    return;
  }
  const list = await readBackupIndex(storage);
  list.push({ key, ownerId });
  await storage.setItem(CLOUD_BACKUP_INDEX_KEY, JSON.stringify(list));
}
