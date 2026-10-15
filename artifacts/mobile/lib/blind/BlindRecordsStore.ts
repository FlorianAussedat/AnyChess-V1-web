/**
 * Persisted best full-move counts for the two Mémorisation modes.
 * One record per mode — perspective (Blancs/Noirs/Aléatoire) does not split.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  numberField,
  readScoreDocument,
  resetScoreDocument,
  resetScoreField,
  stampScalar,
  updateScoreDocument,
} from '../records/scoreDocument.ts';
import type { BlindSubmode } from './types.ts';

const KEY = StorageKeys.blindMemoryRecords.key;

export type BlindMemoryRecords = {
  listenReconstruct: number;
  watchRecite: number;
};

function defaults(): BlindMemoryRecords {
  return { listenReconstruct: 0, watchRecite: 0 };
}

function finiteScore(value: unknown): number | null {
  if (value == null) return 0;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function validate(parsed: unknown): BlindMemoryRecords | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const o = parsed as { listenReconstruct?: unknown; watchRecite?: unknown };
  const listen = finiteScore(o.listenReconstruct);
  const watch = finiteScore(o.watchRecite);
  if (listen == null || watch == null) return null;
  return { listenReconstruct: listen, watchRecite: watch };
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
    const doc = await readScoreDocument(this.storage, KEY);
    return validate(doc) ?? defaults();
  }

  async loadBest(submode: BlindSubmode): Promise<number> {
    const all = await this.load();
    return all[blindRecordField(submode)] ?? 0;
  }

  /** Persist a candidate full-move score if it beats the current best. Returns new best. */
  async saveFullMoves(submode: BlindSubmode, fullMoves: number): Promise<number> {
    const field = blindRecordField(submode);
    const candidate = Math.max(0, Math.floor(fullMoves));
    const at = new Date().toISOString();
    const doc = await updateScoreDocument(this.storage, KEY, (current) => {
      const next = Math.max(numberField(current, field), candidate);
      stampScalar(current, field, next, at);
    });
    return numberField(doc, field);
  }

  async reset(at = new Date().toISOString()): Promise<void> {
    await updateScoreDocument(this.storage, KEY, (current) => {
      resetScoreDocument(current, at, ['listenReconstruct', 'watchRecite'], []);
    });
  }

  async resetMode(submode: BlindSubmode, at = new Date().toISOString()): Promise<void> {
    const field = blindRecordField(submode);
    await updateScoreDocument(this.storage, KEY, (current) => {
      resetScoreField(current, field, at);
    });
  }
}
