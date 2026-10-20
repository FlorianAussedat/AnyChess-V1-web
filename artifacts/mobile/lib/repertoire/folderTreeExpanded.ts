/**
 * Device-local expand/collapse state for the openings folder tree.
 * Survives leaving the screen and restarting the app. Not synced.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';

const KEY = StorageKeys.openingsTreeExpanded.key;

export async function loadExpandedFolderIds(
  storage: KeyValueStorage = defaultKeyValueStorage,
): Promise<string[]> {
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

export async function saveExpandedFolderIds(
  ids: readonly string[],
  storage: KeyValueStorage = defaultKeyValueStorage,
): Promise<void> {
  const unique = [...new Set(ids)];
  await storage.setItem(KEY, JSON.stringify(unique));
}
