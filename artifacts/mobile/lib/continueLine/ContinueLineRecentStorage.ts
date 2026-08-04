/**
 * Persist recent Continue-la-ligne path ids per repertoire folder.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';

const KEY = StorageKeys.continueLineRecent.key;
const MAX_RECENT = 20;

type StoreShape = Record<string, string[]>;

function validateStore(parsed: unknown): StoreShape | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return parsed as StoreShape;
}

export class ContinueLineRecentStorage {
  private storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async getRecentPathIds(folderId: string): Promise<string[]> {
    const all = await this.readAll();
    return all[folderId] ?? [];
  }

  async pushRecentPathId(folderId: string, pathId: string): Promise<void> {
    const all = await this.readAll();
    const prev = all[folderId] ?? [];
    // Prepend; keep a short consecutive streak at the front so anti-repeat
    // can detect A,A (max 2) and block a third when alternatives exist.
    // Older copies of the same id are removed to keep history useful.
    const leadingStreak = prev[0] === pathId ? 1 : 0;
    const head =
      leadingStreak === 1 ? [pathId, pathId] : [pathId];
    const rest = prev.filter((x) => x !== pathId);
    all[folderId] = [...head, ...rest].slice(0, MAX_RECENT);
    await this.storage.setItem(KEY, JSON.stringify(all));
  }

  private async readAll(): Promise<StoreShape> {
    const result = await loadStoredJson(this.storage, KEY, {} as StoreShape, validateStore);
    return result.value;
  }
}

/** App singleton factory. */
export function createContinueLineRecentStorage(
  storage: KeyValueStorage,
): ContinueLineRecentStorage {
  return new ContinueLineRecentStorage(storage);
}
