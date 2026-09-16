/**
 * Endgame favorites — persists position IDs in AsyncStorage.
 * IDs are stable across pool regenerations.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageKeys } from '../storage/StorageKeys.ts';

const KEY = StorageKeys.endgameFavorites.key;

let cache: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = new Set(raw ? JSON.parse(raw) as string[] : []);
  } catch {
    cache = new Set();
  }
  return cache;
}

async function persist(ids: Set<string>): Promise<void> {
  cache = ids;
  await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
}

export async function isFavorite(positionId: string): Promise<boolean> {
  const set = await load();
  return set.has(positionId);
}

export async function toggleFavorite(positionId: string): Promise<boolean> {
  const set = await load();
  if (set.has(positionId)) {
    set.delete(positionId);
    await persist(set);
    return false;
  }
  set.add(positionId);
  await persist(set);
  return true;
}

export async function getFavoriteIds(): Promise<string[]> {
  const set = await load();
  return [...set];
}

export async function removeFavorite(positionId: string): Promise<void> {
  const set = await load();
  set.delete(positionId);
  await persist(set);
}

export function clearFavoritesCache(): void {
  cache = null;
}
