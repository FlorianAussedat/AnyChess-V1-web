/**
 * Centralized read layer for AnyChess personal records.
 * Does NOT invent new scoring — only surfaces stores that already persist data.
 */
import { defaultKeyValueStorage } from '../storage/index.ts';
import {
  MoveNamingRecordsStore,
  type MoveNamingRecords,
} from '../moveNaming/MoveNamingRecords.ts';
import { PlayMoveRecordsStore } from '../playMove/PlayMoveRecords.ts';
import {
  puzzleStreakStore,
  emptyStreakState,
  type PuzzleStreakState,
} from '../puzzles/index.ts';
import {
  BlindRecordsStore,
  type BlindMemoryRecords,
} from '../blind/BlindRecordsStore.ts';
import {
  RECORDS_CATEGORIES,
  listRecordsCategoryIds,
  type RecordsCategoryId,
  type RecordsCategoryMeta,
} from './recordsCatalog.ts';

export type { RecordsCategoryId, RecordsCategoryMeta, MoveNamingRecords, BlindMemoryRecords };
export { RECORDS_CATEGORIES, listRecordsCategoryIds };

const moveNamingStore = new MoveNamingRecordsStore(defaultKeyValueStorage);
const playMoveStore = new PlayMoveRecordsStore(defaultKeyValueStorage);
const blindRecordsStore = new BlindRecordsStore(defaultKeyValueStorage);

export async function loadTacticsRecords(): Promise<PuzzleStreakState> {
  try {
    return await puzzleStreakStore.getSnapshot();
  } catch {
    return emptyStreakState();
  }
}

/** Principal 60-second Nommer le coup best score. */
export async function loadMoveNamingBest(): Promise<number> {
  try {
    return await moveNamingStore.loadBest();
  } catch {
    return 0;
  }
}

/** @deprecated Legacy per-response-second buckets. */
export async function loadMoveNamingRecords(): Promise<MoveNamingRecords> {
  try {
    return await moveNamingStore.load();
  } catch {
    return {};
  }
}

export async function loadPlayMoveBest(): Promise<number> {
  try {
    return await playMoveStore.loadBest();
  } catch {
    return 0;
  }
}

export async function resetTacticsRecords(): Promise<void> {
  await puzzleStreakStore.resetAll();
}

export async function resetMoveNamingRecords(): Promise<void> {
  await moveNamingStore.reset();
}

export async function resetPlayMoveRecords(): Promise<void> {
  await playMoveStore.reset();
}

export async function loadBlindMemoryRecords(): Promise<BlindMemoryRecords> {
  try {
    return await blindRecordsStore.load();
  } catch {
    return { listenReconstruct: 0, watchRecite: 0 };
  }
}

export async function resetBlindMemoryRecords(): Promise<void> {
  await blindRecordsStore.reset();
}

export async function resetMoveNamingCategory(seconds: number): Promise<void> {
  await moveNamingStore.resetCategory(seconds);
}
