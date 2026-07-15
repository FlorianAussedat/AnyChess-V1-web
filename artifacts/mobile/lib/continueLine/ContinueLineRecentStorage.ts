/**
 * Persist recent Continue-la-ligne path ids per repertoire folder.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

const KEY = 'anychess.continueLine.recent.v1';
const MAX_RECENT = 20;

type StoreShape = Record<string, string[]>;

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
    all[folderId] = [pathId, ...prev.filter((x) => x !== pathId)].slice(0, MAX_RECENT);
    await this.storage.setItem(KEY, JSON.stringify(all));
  }

  private async readAll(): Promise<StoreShape> {
    try {
      const raw = await this.storage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== 'object') return {};
      return parsed as StoreShape;
    } catch {
      return {};
    }
  }
}

/** App singleton factory. */
export function createContinueLineRecentStorage(
  storage: KeyValueStorage,
): ContinueLineRecentStorage {
  return new ContinueLineRecentStorage(storage);
}
