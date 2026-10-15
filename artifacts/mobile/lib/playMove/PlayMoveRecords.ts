import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  numberField,
  readScoreDocument,
  resetScoreDocument,
  stampScalar,
  updateScoreDocument,
} from '../records/scoreDocument.ts';

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
  if (best == null) return { best: 0 };
  if (typeof best !== 'number' || !Number.isFinite(best) || best < 0) return null;
  return { best: Math.floor(best) };
}

export class PlayMoveRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async loadBest(): Promise<number> {
    const doc = await readScoreDocument(this.storage, KEY);
    const checked = validate(doc);
    return checked?.best ?? defaults().best;
  }

  /**
   * The candidate is the session score. The stored best is read again at
   * write time so a reset that landed during the calculation is kept.
   */
  async saveScore(
    score: number,
    hooks?: { afterRead?: () => Promise<void> },
  ): Promise<number> {
    const candidate = Math.max(0, Math.floor(score));
    const at = new Date().toISOString();
    const doc = await updateScoreDocument(
      this.storage,
      KEY,
      (current) => {
        const best = Math.max(numberField(current, 'best'), candidate);
        stampScalar(current, 'best', best, at);
      },
      hooks,
    );
    return numberField(doc, 'best');
  }

  async reset(at = new Date().toISOString()): Promise<void> {
    await updateScoreDocument(this.storage, KEY, (current) => {
      resetScoreDocument(current, at, ['best'], []);
    });
  }
}
