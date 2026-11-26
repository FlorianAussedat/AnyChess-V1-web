import {
  usesSharedStorage,
  readSharedDocument,
  writeSharedDocument,
  compactSharedDocument,
} from './sharedDocuments.ts';
import { SYNCABLE_STORAGE_KEYS } from '../cloud/syncableKeys.ts';
import {
  inspectStorage,
  approximateBytes,
  type StorageFailure,
} from './storageDiagnostics.ts';
/**
 * AsyncStorage implementation of KeyValueStorage (React Native / Expo).
 * Keep AsyncStorage imports here — not in mode business logic.
 */
import { cloudStep, reportCloudError } from '../cloud/diagnostics.ts';
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

const failures = new WeakMap<object, StorageFailure>();
function recordFailure(
  backend: object,
  key: string,
  value: string,
  error: ReturnType<typeof reportCloudError>,
) {
  const category = (SYNCABLE_STORAGE_KEYS as readonly string[]).indexOf(key);
  failures.set(backend, {
    stage: /^[a-z0-9_.]{1,100}$/.test(error.stage)
      ? error.stage
      : 'storage.write',
    kind: error.kind,
    category: category < 0 ? null : category,
    requestedBytes: approximateBytes(value),
  });
}
const backendEpochs = new WeakMap<object, number>();
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
  async diagnoseStorage() {
    const epoch = backendEpochs.get(this.backend) ?? 0;
    const report = await inspectStorage(
      this.backend,
      () => (backendEpochs.get(this.backend) ?? 0) === epoch,
    );
    return { ...report, lastFailure: failures.get(this.backend) ?? null };
  }
  async compactItem(key: string): Promise<void> {
    if (!usesSharedStorage(key)) return;
    await serializedUpdate(this.lock, key, async () => {
      backendEpochs.set(
        this.backend,
        (backendEpochs.get(this.backend) ?? 0) + 1,
      );
      try {
        await cloudStep('storage.compact', 'local', () =>
          compactSharedDocument(this.backend, key),
        );
      } catch (error) {
        const safe = reportCloudError('storage.compact', 'local', error);
        try {
          const value = await readSharedDocument(this.backend, key);
          if (value !== null) recordFailure(this.backend, key, value, safe);
        } catch {
          /* Retain original error and bytes. */
        }
        throw safe;
      }
    });
  }
  async getItem(key: string): Promise<string | null> {
    try {
      return await cloudStep('storage.read', 'local', () =>
        usesSharedStorage(key)
          ? serializedUpdate(this.lock, key, () =>
              readSharedDocument(this.backend, key),
            )
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
      let attempted: string | undefined;
      try {
        backendEpochs.set(
          this.backend,
          (backendEpochs.get(this.backend) ?? 0) + 1,
        );
        const current = await (usesSharedStorage(key)
          ? readSharedDocument(this.backend, key)
          : this.backend.getItem(key));
        const next = update(current);
        if (typeof next === 'string') attempted = next;
        if (next === current) return;
        if (next == null) await this.backend.removeItem(key);
        else
          await (usesSharedStorage(key)
            ? writeSharedDocument(this.backend, key, next)
            : this.backend.setItem(key, next));
      } catch (error) {
        notifyError(key);
        const safe = reportCloudError('storage.update', 'local', error);
        if (attempted !== undefined)
          recordFailure(this.backend, key, attempted, safe);
        if (
          usesSharedStorage(key) &&
          attempted !== undefined &&
          typeof __DEV__ !== 'undefined' &&
          __DEV__
        )
          console.warn('[AnyChess storage write]', {
            stage: 'storage.snapshot.refused',
            kind: safe.kind,
            requestedKiB: Math.ceil(approximateBytes(attempted) / 1024),
          });
        throw safe;
      }
      notifyWrite(key, source);
    });
  }

  async setItem(key: string, value: string): Promise<void> {
    if (!usesSharedStorage(key)) return this.updateItem(key, () => value);
    await serializedUpdate(this.lock, key, async () => {
      backendEpochs.set(
        this.backend,
        (backendEpochs.get(this.backend) ?? 0) + 1,
      );
      try {
        await cloudStep('storage.snapshot.write', 'local', () =>
          writeSharedDocument(this.backend, key, value),
        );
      } catch (error) {
        notifyError(key);
        const safe = reportCloudError(
          'storage.snapshot.refused',
          'local',
          error,
        );
        recordFailure(this.backend, key, value, safe);
        if (typeof __DEV__ !== 'undefined' && __DEV__)
          console.warn('[AnyChess storage write]', {
            stage: 'storage.snapshot.refused',
            kind: safe.kind,
            requestedKiB: Math.ceil(approximateBytes(value) / 1024),
          });
        throw safe;
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

export const defaultKeyValueStorage: KeyValueStorage =
  new AsyncKeyValueStorage();
