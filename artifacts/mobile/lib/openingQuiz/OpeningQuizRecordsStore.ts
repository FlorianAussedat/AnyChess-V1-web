/**
 * Persisted best scores for « Quelle ouverture ? » — one best /10 per difficulty.
 * Fresh store (no migration from older stats). No time tiebreak.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { ANYCHESS_DIFFICULTIES } from '../difficulty/anyChessDifficulty.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  mapField,
  readScoreDocument,
  resetScoreDocument,
  resetScoreField,
  stampMapValue,
  updateScoreDocument,
} from '../records/scoreDocument.ts';
import { OPENING_QUIZ_SESSION_SIZE } from './OpeningIdentificationRun.ts';

const KEY = StorageKeys.openingQuizRecords.key;

export type OpeningQuizRecords = {
  bestByDifficulty: Record<AnyChessDifficultyId, number>;
};

function defaults(): OpeningQuizRecords {
  return {
    bestByDifficulty: {
      debutant: 0,
      confirme: 0,
      expert: 0,
      grandMaitre: 0,
    },
  };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(OPENING_QUIZ_SESSION_SIZE, Math.floor(n)));
}

function validate(parsed: unknown): OpeningQuizRecords | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const raw = (parsed as { bestByDifficulty?: unknown }).bestByDifficulty;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const bestByDifficulty = { ...defaults().bestByDifficulty };
  for (const id of ANYCHESS_DIFFICULTIES) {
    const v = src[id];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return null;
    bestByDifficulty[id] = clampScore(v);
  }
  return { bestByDifficulty };
}

export class OpeningQuizRecordsStore {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  async load(): Promise<OpeningQuizRecords> {
    const doc = await readScoreDocument(this.storage, KEY);
    return validate(doc) ?? defaults();
  }

  async loadBest(difficulty: AnyChessDifficultyId): Promise<number> {
    const all = await this.load();
    return all.bestByDifficulty[difficulty] ?? 0;
  }

  /**
   * Persist a candidate score only if it is strictly greater than the current best.
   * Returns the (possibly unchanged) best and whether a new record was set.
   */
  async saveScore(
    difficulty: AnyChessDifficultyId,
    score: number,
  ): Promise<{ best: number; isNewRecord: boolean }> {
    const candidate = clampScore(score);
    const at = new Date().toISOString();
    let isNewRecord = false;
    const doc = await updateScoreDocument(this.storage, KEY, (current) => {
      const previous = mapField(current, 'bestByDifficulty', difficulty);
      if (candidate <= previous) return;
      isNewRecord = true;
      stampMapValue(current, 'bestByDifficulty', difficulty, candidate, at);
    });
    const best = mapField(doc, 'bestByDifficulty', difficulty);
    return { best, isNewRecord };
  }

  async reset(at = new Date().toISOString()): Promise<void> {
    await updateScoreDocument(this.storage, KEY, (current) => {
      const bag = {
        debutant: 0,
        confirme: 0,
        expert: 0,
        grandMaitre: 0,
      };
      current.bestByDifficulty = bag;
      resetScoreDocument(current, at, [], ['bestByDifficulty']);
    });
  }

  async resetDifficulty(difficulty: AnyChessDifficultyId, at = new Date().toISOString()): Promise<void> {
    await updateScoreDocument(this.storage, KEY, (current) => {
      resetScoreField(current, `bestByDifficulty.${difficulty}`, at);
    });
  }
}
