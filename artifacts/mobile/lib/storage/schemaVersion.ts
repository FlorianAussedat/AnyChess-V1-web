/**
 * Application-level storage schema versioning.
 *
 * Feature documents (repertoire v1→v2, etc.) keep their own payload versions.
 * This module stamps an ordered app schema so future AnyChess releases can
 * evolve keys / shapes without silently dropping user data.
 */
import type { KeyValueStorage } from './KeyValueStorage.ts';
import { StorageKeys } from './StorageKeys.ts';

/** Bump when adding a new migration in `migrations.ts`. */
export const CURRENT_STORAGE_SCHEMA_VERSION = 1;

export type StorageMigration = {
  from: number;
  to: number;
  /**
   * Ordered step from `from` → `to`. Must be idempotent when possible.
   * Must not wipe unrelated keys.
   */
  migrate: (storage: KeyValueStorage) => Promise<void>;
};

export async function readStorageSchemaVersion(
  storage: KeyValueStorage,
): Promise<number> {
  try {
    const raw = await storage.getItem(StorageKeys.schemaVersion.key);
    if (raw == null || raw === '') return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export async function writeStorageSchemaVersion(
  storage: KeyValueStorage,
  version: number,
): Promise<void> {
  await storage.setItem(StorageKeys.schemaVersion.key, String(version));
}
