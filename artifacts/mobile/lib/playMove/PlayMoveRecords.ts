import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';

const KEY = StorageKeys.playMoveSession60.key;

export type PlayMoveSession60Record = {
  best: number;
};

function defaults(): PlayMoveSession60Record {
  return { best: 0 };
}

function validate(parsed: unknown): PlayMoveSession60Record | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const best = (parsed as { best?: unknown }).best;
  if (typeof best !== 'number' || !Number.isFinite(best) || best < 0) return null;
  return { best: Math.floor(best) };
}

export class PlayMoveRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async loadBest(): Promise<number> {
    const result = await loadStoredJson(this.storage, KEY, defaults(), validate);
    return result.value.best;
  }

  async saveScore(score: number): Promise<number> {
    const best = Math.max(await this.loadBest(), Math.max(0, Math.floor(score)));
    await this.storage.setItem(KEY, JSON.stringify({ best } satisfies PlayMoveSession60Record));
    return best;
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(KEY);
  }
}
