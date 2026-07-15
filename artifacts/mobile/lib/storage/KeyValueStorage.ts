/**
 * Platform-independent key–value storage.
 * Business logic should depend on this interface; AsyncStorage is one backend.
 * Future Android native storage can implement the same contract.
 */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiRemove?(keys: string[]): Promise<void>;
}

/** In-memory backend for unit tests. */
export class MemoryKeyValueStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.map.delete(key);
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const k of keys) this.map.delete(k);
  }
}
