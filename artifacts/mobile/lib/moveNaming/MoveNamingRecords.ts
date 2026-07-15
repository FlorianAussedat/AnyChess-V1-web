import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

const KEY = 'anychess.move-naming.records.v1';
export type MoveNamingRecords = Record<number, number>;

function defaults(): MoveNamingRecords {
  return Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0]));
}

export class MoveNamingRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async load(): Promise<MoveNamingRecords> {
    const raw = await this.storage.getItem(KEY);
    if (!raw) return defaults();
    try {
      return { ...defaults(), ...JSON.parse(raw) };
    } catch {
      return defaults();
    }
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
}
