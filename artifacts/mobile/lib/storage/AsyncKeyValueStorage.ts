/**
 * AsyncStorage implementation of KeyValueStorage (React Native / Expo).
 * Keep AsyncStorage imports here — not in mode business logic.
 */
import { cloudStep, reportCloudError } from '../cloud/diagnostics.ts';
import { isSnapshotKey, readSnapshot, writeSnapshot, removeSnapshot } from './snapshotStorage.ts';
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

const backendLocks = new WeakMap<object, object>();
export class AsyncKeyValueStorage implements KeyValueStorage {
  private readonly lock: object;
  private readonly backend: KeyValueStorage;
  constructor(backend: KeyValueStorage = AsyncStorage) {
    this.backend = backend;
    let lock = backendLocks.get(backend);
    if (!lock) {
      lock = {};
      backendLocks.set(backend, lock);
    }
    this.lock = lock;
  }
  async getItem(key: string): Promise<string | null> {
    try {
      return await cloudStep('storage.read', 'local', () =>
        isSnapshotKey(key)
          ? serializedUpdate(this.lock, key, () => readSnapshot(this.backend, key))
          : this.backend.getItem(key),
      );
    } catch (error) {
      notifyError(key);
      throw error;
    }
  }

  async updateItem(
    key: string,
    update: (current: string | null) => string | null,
    source?: 'cloud',
  ): Promise<void> {
    await serializedUpdate(this.lock, key, async () => {
      try {
        const current = await (isSnapshotKey(key)
          ? readSnapshot(this.backend, key)
          : this.backend.getItem(key));
        const next = update(current);
        if (next === current) return;
        if (next == null)
          await (isSnapshotKey(key)
            ? removeSnapshot(this.backend, key)
            : this.backend.removeItem(key));
        else
          await (isSnapshotKey(key)
            ? writeSnapshot(this.backend, key, next)
            : this.backend.setItem(key, next));
      } catch (error) {
        notifyError(key);
        throw reportCloudError('storage.update', 'local', error);
      }
      notifyWrite(key, source);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!isSnapshotKey(key)) return this.updateItem(key, () => value);
    await serializedUpdate(this.lock, key, async () => {
      try {
        await cloudStep('storage.snapshot.write', 'local', () =>
          writeSnapshot(this.backend, key, value),
        );
      } catch (error) {
        notifyError(key);
        throw error;
      }
      notifyWrite(key);
    });
  }

  async removeItem(key: string): Promise<void> {
    await this.updateItem(key, () => null);
  }

  async multiRemove(keys: string[]): Promise<void> {
    for (const key of keys) await this.removeItem(key);
  }

  async getAllKeys(): Promise<readonly string[]> {
    return (await this.backend.getAllKeys?.()) ?? [];
  }
}

export const defaultKeyValueStorage: KeyValueStorage = new AsyncKeyValueStorage();
