/**
 * AsyncStorage implementation of KeyValueStorage (React Native / Expo).
 * Keep AsyncStorage imports here — not in mode business logic.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from './KeyValueStorage.ts';

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
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async multiRemove(keys: string[]): Promise<void> {
    await AsyncStorage.multiRemove(keys);
  }
}

export const defaultKeyValueStorage: KeyValueStorage = new AsyncKeyValueStorage();
