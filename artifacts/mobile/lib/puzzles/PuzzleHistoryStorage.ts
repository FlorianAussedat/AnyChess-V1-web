/**
 * Persist recent puzzle IDs + lightweight attempt history (AsyncStorage).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PuzzleHistoryRecord } from './types';

const RECENT_KEY = 'anychess.puzzles.recent.v1';
const HISTORY_KEY = 'anychess.puzzles.history.v1';

const MAX_RECENT = 50;
const MAX_HISTORY = 200;

export class PuzzleHistoryStorage {
  async getRecentIds(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((x): x is string => typeof x === 'string');
    } catch {
      return [];
    }
  }

  async pushRecentId(id: string): Promise<void> {
    const prev = await this.getRecentIds();
    const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  async getHistory(): Promise<PuzzleHistoryRecord[]> {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed as PuzzleHistoryRecord[];
    } catch {
      return [];
    }
  }

  async appendHistory(record: PuzzleHistoryRecord): Promise<void> {
    const prev = await this.getHistory();
    const next = [record, ...prev].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  }

  async clear(): Promise<void> {
    await AsyncStorage.multiRemove([RECENT_KEY, HISTORY_KEY]);
  }
}

export const puzzleHistoryStorage = new PuzzleHistoryStorage();
