/**
 * AsyncStorage implementation of KeyValueStorage (React Native / Expo).
 * Keep AsyncStorage imports here — not in mode business logic.
 */
import { serializedUpdate } from './serializedUpdate.ts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './KeyValueStorage.ts';

type WriteListener = (key: string, source?: 'cloud') => void;
const writeListeners = new Set<WriteListener>();
const errorListeners = new Set<WriteListener>();

export function subscribeKeyValueWrites(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

function notifyWrite(key: string, source?: 'cloud'): void {
  for (const listener of writeListeners) {
    try {
      listener(key, source);
    } catch {
      // listeners must not break persistence
    }
  }
}

export function subscribeKeyValueErrors(listener: WriteListener): () => void {
  errorListeners.add(listener);
  return () => {
    errorListeners.delete(listener);
  };
}

function notifyError(key: string): void {
  for (const listener of errorListeners) {
    try {
      listener(key);
    } catch {
      // listeners must not break persistence
    }
  }
}

export class AsyncKeyValueStorage implements KeyValueStorage {
  async getItem(key: string): Promise<string | null> {
    try { return await AsyncStorage.getItem(key); } catch (error) { notifyError(key); throw error; }
  }

  async updateItem(key: string, update: (current: string | null) => string | null, source?: 'cloud'): Promise<void> {
    await serializedUpdate(this, key, async () => {
      try {
        const current = await AsyncStorage.getItem(key);
        const next = update(current);
        if (next === current) return;
        if (next == null) await AsyncStorage.removeItem(key);
        else await AsyncStorage.setItem(key, next);
      } catch (error) {
        notifyError(key);
        throw error;
      }
      notifyWrite(key, source);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.updateItem(key, () => value);
  }

  async removeItem(key: string): Promise<void> {
    await this.updateItem(key, () => null);
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) await this.removeItem(key);
  }

  async getAllKeys(): Promise<readonly string[]> {
    return AsyncStorage.getAllKeys();
  }
}

export const defaultKeyValueStorage: KeyValueStorage = new AsyncKeyValueStorage();
