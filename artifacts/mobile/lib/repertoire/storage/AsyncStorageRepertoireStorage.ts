/**
 * AsyncStorage-backed RepertoireStorage.
 *
 * Suitable for web (localStorage under the hood) and React Native. Keeps the
 * whole repertoire store as a single JSON document under a versioned key.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RepertoireStorage } from './RepertoireStorage';
import type { RepertoireStoreSnapshot } from './types';
import { emptyRepertoireStore } from './types';

const STORAGE_KEY = 'anychess.repertoire.v1';

export class AsyncStorageRepertoireStorage implements RepertoireStorage {
  async load(): Promise<RepertoireStoreSnapshot> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyRepertoireStore();
      const parsed = JSON.parse(raw) as RepertoireStoreSnapshot;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.folders) || !Array.isArray(parsed.files)) {
        return emptyRepertoireStore();
      }
      return parsed;
    } catch {
      return emptyRepertoireStore();
    }
  }

  async save(snapshot: RepertoireStoreSnapshot): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

/** Default singleton used by RepertoireService. */
export const defaultRepertoireStorage: RepertoireStorage =
  new AsyncStorageRepertoireStorage();
