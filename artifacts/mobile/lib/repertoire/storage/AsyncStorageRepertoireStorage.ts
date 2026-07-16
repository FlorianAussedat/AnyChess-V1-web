/**
 * AsyncStorage-backed RepertoireStorage.
 *
 * Suitable for web (localStorage under the hood) and React Native. Keeps the
 * whole repertoire store as a single JSON document under a versioned key.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RepertoireStorage } from './RepertoireStorage';
import type { RepertoireStoreSnapshot } from './types';
import { emptyRepertoireStore, normalizeRepertoireStore } from './types';

const STORAGE_KEY = 'anychess.repertoire.v2';

export class AsyncStorageRepertoireStorage implements RepertoireStorage {
  async load(): Promise<RepertoireStoreSnapshot> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const legacy = await AsyncStorage.getItem('anychess.repertoire.v1');
        if (legacy) {
          const migrated = normalizeRepertoireStore(JSON.parse(legacy));
          await this.save(migrated);
          await AsyncStorage.removeItem('anychess.repertoire.v1');
          return migrated;
        }
        return emptyRepertoireStore();
      }
      return normalizeRepertoireStore(JSON.parse(raw));
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
