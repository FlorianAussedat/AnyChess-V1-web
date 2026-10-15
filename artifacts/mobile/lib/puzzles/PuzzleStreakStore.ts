/**
 * Persist puzzle streaks / personal bests per filter band.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import {
  readScoreDocument,
  resetScoreDocument,
  stampMapValue,
  updateScoreDocument,
} from '../records/scoreDocument.ts';

export const PUZZLE_STREAK_STORAGE_KEY = StorageKeys.puzzleStreaks.key;

export interface PuzzleStreakState {
  currentByBand: Record<string, number>;
  bestByBand: Record<string, number>;
}

export function emptyStreakState(): PuzzleStreakState {
  return { currentByBand: {}, bestByBand: {} };
}

/**
 * Pure streak update for tests / callers that manage persistence themselves.
 * Solved → current += 1, best = max(best, current).
 * Failed → current = 0 (best unchanged).
 */
export function applyStreakResult(
  state: PuzzleStreakState,
  bandId: string,
  solved: boolean,
): PuzzleStreakState {
  const currentByBand = { ...state.currentByBand };
  const bestByBand = { ...state.bestByBand };
  if (!bandId) {
    return { currentByBand, bestByBand };
  }

  if (solved) {
    const next = (currentByBand[bandId] ?? 0) + 1;
    currentByBand[bandId] = next;
    bestByBand[bandId] = Math.max(bestByBand[bandId] ?? 0, next);
  } else {
    currentByBand[bandId] = 0;
  }

  return { currentByBand, bestByBand };
}

function validateStreakState(parsed: unknown): PuzzleStreakState | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const p = parsed as Partial<PuzzleStreakState>;
  return {
    currentByBand:
      p.currentByBand && typeof p.currentByBand === 'object' && !Array.isArray(p.currentByBand)
        ? { ...p.currentByBand }
        : {},
    bestByBand:
      p.bestByBand && typeof p.bestByBand === 'object' && !Array.isArray(p.bestByBand)
        ? { ...p.bestByBand }
        : {},
  };
}

export class PuzzleStreakStore {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  constructor(
    storage: KeyValueStorage = defaultKeyValueStorage,
    key: string = PUZZLE_STREAK_STORAGE_KEY,
  ) {
    this.storage = storage;
    this.key = key;
  }

  async getSnapshot(): Promise<PuzzleStreakState> {
    const doc = await readScoreDocument(this.storage, this.key);
    return validateStreakState(doc) ?? emptyStreakState();
  }

  async recordResult(
    bandId: string,
    solved: boolean,
  ): Promise<{ current: number; best: number }> {
    const at = new Date().toISOString();
    const doc = await updateScoreDocument(this.storage, this.key, (current) => {
      const prev = validateStreakState(current) ?? emptyStreakState();
      const next = applyStreakResult(prev, bandId, solved);
      current.currentByBand = next.currentByBand;
      current.bestByBand = next.bestByBand;
      if (bandId) {
        stampMapValue(current, 'currentByBand', bandId, next.currentByBand[bandId] ?? 0, at);
        if (solved) {
          stampMapValue(current, 'bestByBand', bandId, next.bestByBand[bandId] ?? 0, at);
        }
      }
    });
    const snap = validateStreakState(doc) ?? emptyStreakState();
    return {
      current: snap.currentByBand[bandId] ?? 0,
      best: snap.bestByBand[bandId] ?? 0,
    };
  }

  async resetAll(at = new Date().toISOString()): Promise<void> {
    await updateScoreDocument(this.storage, this.key, (current) => {
      current.currentByBand = {};
      current.bestByBand = {};
      resetScoreDocument(current, at, [], ['currentByBand', 'bestByBand']);
    });
  }
}

export const puzzleStreakStore = new PuzzleStreakStore();
