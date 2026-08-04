/**
 * AsyncStorage-backed RepertoireStorage via KeyValueStorage.
 *
 * Suitable for web (localStorage under the hood) and React Native. Keeps the
 * whole repertoire store as a single JSON document under a versioned key.
 */
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { loadStoredJson } from '../../storage/safeParse.ts';
import type { RepertoireStorage } from './RepertoireStorage.ts';
import type { RepertoireStoreSnapshot } from './types.ts';
import { emptyRepertoireStore, normalizeRepertoireStore } from './types.ts';

function validateRepertoire(raw: unknown): RepertoireStoreSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as { version?: unknown; folders?: unknown; files?: unknown };
  if (!Array.isArray(parsed.folders) || !Array.isArray(parsed.files)) return null;
  if (parsed.version !== 1 && parsed.version !== 2) return null;
  return normalizeRepertoireStore(raw);
}

export class AsyncStorageRepertoireStorage implements RepertoireStorage {
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async load(): Promise<RepertoireStoreSnapshot> {
    const primary = await loadStoredJson(
      this.storage,
      StorageKeys.repertoires.key,
      emptyRepertoireStore(),
      validateRepertoire,
    );
    if (primary.status === 'ok') {
      return primary.value;
    }
    if (primary.status === 'corrupt') {
      // Keep corrupt v2 bytes; return safe empty without overwriting.
      return emptyRepertoireStore();
    }

    // Missing v2 — try legacy v1 migrate-once.
    const legacy = await loadStoredJson(
      this.storage,
      StorageKeys.repertoiresLegacyV1.key,
      emptyRepertoireStore(),
      validateRepertoire,
    );
    if (legacy.status === 'ok') {
      const migrated = legacy.value;
      await this.save(migrated);
      try {
        await this.storage.removeItem(StorageKeys.repertoiresLegacyV1.key);
      } catch {
        /* non-critical */
      }
      return migrated;
    }
    if (legacy.status === 'corrupt') {
      return emptyRepertoireStore();
    }
    return emptyRepertoireStore();
  }

  async save(snapshot: RepertoireStoreSnapshot): Promise<void> {
    await this.storage.setItem(
      StorageKeys.repertoires.key,
      JSON.stringify(snapshot),
    );
  }

  async clear(): Promise<void> {
    await this.storage.removeItem(StorageKeys.repertoires.key);
    await this.storage.removeItem(StorageKeys.repertoiresLegacyV1.key);
  }
}

/** Default singleton used by RepertoireService. */
export const defaultRepertoireStorage: RepertoireStorage =
  new AsyncStorageRepertoireStorage();
