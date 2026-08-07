/**
 * Persist recent puzzle IDs + lightweight attempt history (KeyValueStorage).
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import type { PuzzleHistoryRecord } from './types.ts';

const MAX_RECENT = 50;
const MAX_HISTORY = 200;

function validateRecentIds(parsed: unknown): string[] | null {
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((x): x is string => typeof x === 'string');
}

function validateHistory(parsed: unknown): PuzzleHistoryRecord[] | null {
  if (!Array.isArray(parsed)) return null;
  return parsed as PuzzleHistoryRecord[];
}

export class PuzzleHistoryStorage {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async getRecentIds(): Promise<string[]> {
    const result = await loadStoredJson(
      this.storage,
      StorageKeys.puzzleRecent.key,
      [] as string[],
      validateRecentIds,
    );
    return result.value;
  }

  async pushRecentId(id: string): Promise<void> {
    const prev = await this.getRecentIds();
    // If underlying key is still corrupt, getRecentIds returned [] without
    // wiping it. A deliberate write (user played a puzzle) replaces it.
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
    await this.storage.setItem(
      StorageKeys.puzzleRecent.key,
      JSON.stringify(next),
    );
  }

  async getHistory(): Promise<PuzzleHistoryRecord[]> {
    const result = await loadStoredJson(
      this.storage,
      StorageKeys.puzzleHistory.key,
      [] as PuzzleHistoryRecord[],
      validateHistory,
    );
    return result.value;
  }

  async appendHistory(record: PuzzleHistoryRecord): Promise<void> {
    const prev = await this.getHistory();
    const next = [record, ...prev].slice(0, MAX_HISTORY);
    await this.storage.setItem(
      StorageKeys.puzzleHistory.key,
      JSON.stringify(next),
    );
  }

  async clear(): Promise<void> {
    const keys = [
      StorageKeys.puzzleRecent.key,
      StorageKeys.puzzleHistory.key,
    ];
    if (this.storage.multiRemove) {
      await this.storage.multiRemove(keys);
    } else {
      await Promise.all(keys.map((k) => this.storage.removeItem(k)));
    }
  }
}

export const puzzleHistoryStorage = new PuzzleHistoryStorage();
