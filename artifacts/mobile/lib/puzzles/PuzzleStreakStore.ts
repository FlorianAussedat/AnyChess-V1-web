/**
 * Persist puzzle streaks / personal bests per filter band.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';

export const PUZZLE_STREAK_STORAGE_KEY = 'anychess.puzzles.streaks.v1';

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

function parseState(raw: string | null): PuzzleStreakState {
  if (!raw) return emptyStreakState();
  try {
    const parsed = JSON.parse(raw) as Partial<PuzzleStreakState>;
    return {
      currentByBand:
        parsed.currentByBand && typeof parsed.currentByBand === 'object'
          ? { ...parsed.currentByBand }
          : {},
      bestByBand:
        parsed.bestByBand && typeof parsed.bestByBand === 'object'
          ? { ...parsed.bestByBand }
          : {},
    };
  } catch {
    return emptyStreakState();
  }
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
    const raw = await this.storage.getItem(this.key);
    return parseState(raw);
  }

  async recordResult(
    bandId: string,
    solved: boolean,
  ): Promise<{ current: number; best: number }> {
    const prev = await this.getSnapshot();
    const next = applyStreakResult(prev, bandId, solved);
    await this.storage.setItem(this.key, JSON.stringify(next));
    return {
      current: next.currentByBand[bandId] ?? 0,
      best: next.bestByBand[bandId] ?? 0,
    };
  }

  async resetAll(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}

export const puzzleStreakStore = new PuzzleStreakStore();
