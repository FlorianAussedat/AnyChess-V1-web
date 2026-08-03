/**
 * Centralized read layer for AnyChess personal records.
 * Does NOT invent new scoring — only surfaces stores that already persist data.
 */
import { defaultKeyValueStorage } from '../storage/index.ts';
import {
  MoveNamingRecordsStore,
  type MoveNamingRecords,
} from '../moveNaming/MoveNamingRecords.ts';
import {
  puzzleStreakStore,
  emptyStreakState,
  type PuzzleStreakState,
} from '../puzzles/index.ts';
import {
  RECORDS_CATEGORIES,
  listRecordsCategoryIds,
  type RecordsCategoryId,
  type RecordsCategoryMeta,
} from './recordsCatalog.ts';

export type { RecordsCategoryId, RecordsCategoryMeta, MoveNamingRecords };
export { RECORDS_CATEGORIES, listRecordsCategoryIds };

const moveNamingStore = new MoveNamingRecordsStore(defaultKeyValueStorage);

export async function loadTacticsRecords(): Promise<PuzzleStreakState> {
  try {
    return await puzzleStreakStore.getSnapshot();
  } catch {
    return emptyStreakState();
  }
}

export async function loadMoveNamingRecords(): Promise<MoveNamingRecords> {
  try {
    return await moveNamingStore.load();
  } catch {
    return {};
  }
}

export async function resetTacticsRecords(): Promise<void> {
  await puzzleStreakStore.resetAll();
}

export async function resetMoveNamingRecords(): Promise<void> {
  await moveNamingStore.reset();
}

export async function resetMoveNamingCategory(seconds: number): Promise<void> {
  await moveNamingStore.resetCategory(seconds);
}
