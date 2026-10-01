/**
 * AsyncStorage implementation of KeyValueStorage (React Native / Expo).
 * Keep AsyncStorage imports here — not in mode business logic.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './KeyValueStorage.ts';

type WriteListener = (key: string) => void;
const writeListeners = new Set<WriteListener>();

export function subscribeKeyValueWrites(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

function notifyWrite(key: string): void {
  for (const listener of writeListeners) {
    try {
      listener(key);
    } catch {
      // listeners must not break persistence
    }
  }
}

export class AsyncKeyValueStorage implements KeyValueStorage {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
    notifyWrite(key);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    notifyWrite(key);
  }

  async multiRemove(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
    for (const key of keys) notifyWrite(key);
  }
}

export const defaultKeyValueStorage: KeyValueStorage = new AsyncKeyValueStorage();
