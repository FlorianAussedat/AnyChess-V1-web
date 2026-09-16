/**
 * Persisted best scores for « Quelle ouverture ? » — one best /10 per difficulty.
 * Fresh store (no migration from older stats). No time tiebreak.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { ANYCHESS_DIFFICULTIES } from '../difficulty/anyChessDifficulty.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
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
    const result = await loadStoredJson(this.storage, KEY, defaults(), validate);
    return result.value;
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
    const all = await this.load();
    const candidate = clampScore(score);
    const current = all.bestByDifficulty[difficulty] ?? 0;
    if (candidate <= current) {
      return { best: current, isNewRecord: false };
    }
    const updated: OpeningQuizRecords = {
      bestByDifficulty: { ...all.bestByDifficulty, [difficulty]: candidate },
    };
    await this.storage.setItem(KEY, JSON.stringify(updated satisfies OpeningQuizRecords));
    return { best: candidate, isNewRecord: true };
  }

  async reset(): Promise<void> {
    await this.storage.removeItem(KEY);
  }

  async resetDifficulty(difficulty: AnyChessDifficultyId): Promise<void> {
    const all = await this.load();
    const updated: OpeningQuizRecords = {
      bestByDifficulty: { ...all.bestByDifficulty, [difficulty]: 0 },
    };
    await this.storage.setItem(KEY, JSON.stringify(updated satisfies OpeningQuizRecords));
  }
}
