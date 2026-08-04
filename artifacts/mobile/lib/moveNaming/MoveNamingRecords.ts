/**
 * Nommer le coup — 60-second principal record store.
 *
 * Legacy per-response-second buckets remain on `StorageKeys.moveNamingRecords`
 * (v1) and are preserved but no longer written by the new session model.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';

const KEY = StorageKeys.moveNamingSession60.key;

export type MoveNamingSession60Record = {
  best: number;
};

function defaults(): MoveNamingSession60Record {
  return { best: 0 };
}

function validate(parsed: unknown): MoveNamingSession60Record | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const best = (parsed as { best?: unknown }).best;
  if (typeof best !== 'number' || !Number.isFinite(best) || best < 0) return null;
  return { best: Math.floor(best) };
}

export class MoveNamingRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async loadBest(): Promise<number> {
    const result = await loadStoredJson(this.storage, KEY, defaults(), validate);
    return result.value.best;
  }

  /** Persist best score for the 60-second mode; returns the updated best. */
  async saveScore(score: number): Promise<number> {
    const best = Math.max(await this.loadBest(), Math.max(0, Math.floor(score)));
    await this.storage.setItem(KEY, JSON.stringify({ best } satisfies MoveNamingSession60Record));
    return best;
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(KEY);
  }

  // ── Legacy v1 API (read/reset only — no longer written by sessions) ──────

  /** @deprecated Legacy buckets by response seconds — preserved for migration safety. */
  async load(): Promise<Record<number, number>> {
    const legacyKey = StorageKeys.moveNamingRecords.key;
    const result = await loadStoredJson(
      this.storage,
      legacyKey,
      Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0])) as Record<number, number>,
      (parsed) => {
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return {
          ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 0])),
          ...(parsed as Record<number, number>),
        };
      },
    );
    return result.value;
  }

  /** @deprecated No-op for new model callers; kept so old tests compile during transition. */
  async saveScoreLegacy(responseSeconds: number, score: number): Promise<Record<number, number>> {
    if (!Number.isInteger(responseSeconds) || responseSeconds < 1 || responseSeconds > 10) {
      throw new Error('Le délai doit être compris entre 1 et 10 secondes.');
    }
    const records = await this.load();
    records[responseSeconds] = Math.max(records[responseSeconds] ?? 0, score);
    await this.storage.setItem(StorageKeys.moveNamingRecords.key, JSON.stringify(records));
    return records;
  }

  async resetCategory(responseSeconds: number): Promise<Record<number, number>> {
    if (!Number.isInteger(responseSeconds) || responseSeconds < 1 || responseSeconds > 10) {
      throw new Error('Le délai doit être compris entre 1 et 10 secondes.');
    }
    const records = await this.load();
    records[responseSeconds] = 0;
    await this.storage.setItem(StorageKeys.moveNamingRecords.key, JSON.stringify(records));
    return records;
  }

  async resetLegacy(): Promise<void> {
    await this.storage.removeItem(StorageKeys.moveNamingRecords.key);
  }
}

/** @deprecated Alias — prefer MoveNamingSession60Record. */
export type MoveNamingRecords = Record<number, number>;
