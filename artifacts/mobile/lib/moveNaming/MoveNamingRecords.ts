import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';

const KEY = StorageKeys.moveNamingRecords.key;
export type MoveNamingRecords = Record<number, number>;

function defaults(): MoveNamingRecords {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0]));
}

function validateRecords(parsed: unknown): MoveNamingRecords | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  return { ...defaults(), ...(parsed as MoveNamingRecords) };
}

export class MoveNamingRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async load(): Promise<MoveNamingRecords> {
    const result = await loadStoredJson(
      this.storage,
      KEY,
      defaults(),
      validateRecords,
    );
    return result.value;
  }

  async saveScore(responseSeconds: number, score: number): Promise<MoveNamingRecords> {
    if (!Number.isInteger(responseSeconds) || responseSeconds < 1 || responseSeconds > 10) {
      throw new Error('Le délai doit être compris entre 1 et 10 secondes.');
    }
    const records = await this.load();
    records[responseSeconds] = Math.max(records[responseSeconds] ?? 0, score);
    await this.storage.setItem(KEY, JSON.stringify(records));
    return records;
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(KEY);
  }

  async resetCategory(responseSeconds: number): Promise<MoveNamingRecords> {
    if (!Number.isInteger(responseSeconds) || responseSeconds < 1 || responseSeconds > 10) {
      throw new Error('Le délai doit être compris entre 1 et 10 secondes.');
    }
    const records = await this.load();
    records[responseSeconds] = 0;
    await this.storage.setItem(KEY, JSON.stringify(records));
    return records;
  }
}
