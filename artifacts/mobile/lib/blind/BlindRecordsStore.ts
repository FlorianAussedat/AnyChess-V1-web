/**
 * Persisted best full-move counts for the two Mémorisation modes.
 * One record per mode — perspective (Blancs/Noirs/Aléatoire) does not split.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import type { BlindSubmode } from './types.ts';

const KEY = StorageKeys.blindMemoryRecords.key;

export type BlindMemoryRecords = {
  listenReconstruct: number;
  watchRecite: number;
};

function defaults(): BlindMemoryRecords {
  return { listenReconstruct: 0, watchRecite: 0 };
}

function validate(parsed: unknown): BlindMemoryRecords | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as { listenReconstruct?: unknown; watchRecite?: unknown };
  const listen = o.listenReconstruct;
  const watch = o.watchRecite;
  if (typeof listen !== 'number' || !Number.isFinite(listen) || listen < 0) return null;
  if (typeof watch !== 'number' || !Number.isFinite(watch) || watch < 0) return null;
  return {
    listenReconstruct: Math.floor(listen),
    watchRecite: Math.floor(watch),
  };
}

export function blindRecordField(submode: BlindSubmode): keyof BlindMemoryRecords {
  return submode === 'listen-reconstruct' ? 'listenReconstruct' : 'watchRecite';
}

export class BlindRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async load(): Promise<BlindMemoryRecords> {
    const result = await loadStoredJson(this.storage, KEY, defaults(), validate);
    return result.value;
  }

  async loadBest(submode: BlindSubmode): Promise<number> {
    const all = await this.load();
    return all[blindRecordField(submode)] ?? 0;
  }

  /** Persist a candidate full-move score if it beats the current best. Returns new best. */
  async saveFullMoves(submode: BlindSubmode, fullMoves: number): Promise<number> {
    const all = await this.load();
    const field = blindRecordField(submode);
    const next = Math.max(all[field], Math.max(0, Math.floor(fullMoves)));
    const updated = { ...all, [field]: next };
    await this.storage.setItem(KEY, JSON.stringify(updated satisfies BlindMemoryRecords));
    return next;
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(KEY);
  }

  async resetMode(submode: BlindSubmode): Promise<void> {
    const all = await this.load();
    const field = blindRecordField(submode);
    const updated = { ...all, [field]: 0 };
    await this.storage.setItem(KEY, JSON.stringify(updated satisfies BlindMemoryRecords));
  }
}
