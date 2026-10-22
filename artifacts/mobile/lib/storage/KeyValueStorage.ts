import { serializedUpdate } from './serializedUpdate.ts';
/**
 * Platform-independent key–value storage.
 * Business logic should depend on this interface; AsyncStorage is one backend.
 * Future Android native storage can implement the same contract.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  updateItem?(key: string, update: (current: string | null) => string | null, source?: 'cloud'): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove?(keys: string[]): Promise<void>;
  /** Present on AsyncStorage and the in-memory test backend. */
  getAllKeys?(): Promise<readonly string[]>;
}

/** In-memory backend for unit tests. */
export class MemoryKeyValueStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.updateItem(key, () => value);
  }

  async removeItem(key: string): Promise<void> {
    await this.updateItem(key, () => null);
  }

  async updateItem(key: string, update: (current: string | null) => string | null): Promise<void> {
    await serializedUpdate(this, key, async () => {
      const value = update(await this.getItem(key));
      if (value === null) this.map.delete(key);
      else this.map.set(key, value);
    });
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) await this.removeItem(key);
  }

  async getAllKeys(): Promise<readonly string[]> {
    return [...this.map.keys()];
  }
}
