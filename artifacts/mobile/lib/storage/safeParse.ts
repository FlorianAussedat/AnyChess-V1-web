/**
 * Safe JSON load helpers for persisted feature data.
 *
 * On corruption:
 * - return a safe fallback to the UI
 * - do not overwrite the primary key
 * - quarantine a one-time backup under `${key}.corrupt` when practical
 * - report via reportStorageCorruption (dev console)
 */
import type { KeyValueStorage } from './KeyValueStorage.ts';
import { corruptBackupKey } from './StorageKeys.ts';
import { reportStorageCorruption } from './reportCorruption.ts';

export type SafeJsonStatus = 'ok' | 'missing' | 'corrupt';

export interface SafeJsonLoadResult<T> {
  value: T;
  status: SafeJsonStatus;
  raw: string | null;
  reason?: 'invalid_json' | 'validation_failed';
}

const PREVIEW_MAX = 240;

export function parseStoredJson<T>(
  raw: string | null | undefined,
  fallback: T,
  validate: (parsed: unknown) => T | null,
): SafeJsonLoadResult<T> {
  if (raw == null || raw === '') {
    return { value: fallback, status: 'missing', raw: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return {
      value: fallback,
      status: 'corrupt',
      raw,
      reason: 'invalid_json',
    };
  }
  const validated = validate(parsed);
  if (validated == null) {
    return {
      value: fallback,
      status: 'corrupt',
      raw,
      reason: 'validation_failed',
    };
  }
  return { value: validated, status: 'ok', raw };
}

/**
 * Quarantine corrupt payload once. Leaves the primary key untouched so a
 * future app version / manual recovery can still see the original bytes.
 */
export async function quarantineCorruptValue(
  storage: KeyValueStorage,
  key: string,
  raw: string,
  reason: 'invalid_json' | 'validation_failed',
): Promise<void> {
  const preview =
    raw.length > PREVIEW_MAX ? `${raw.slice(0, PREVIEW_MAX)}…` : raw;
  reportStorageCorruption({ key, reason, preview });

  const backup = corruptBackupKey(key);
  try {
    const existing = await storage.getItem(backup);
    if (existing == null) {
      await storage.setItem(backup, raw);
    }
  } catch {
    /* quarantine is best-effort */
  }
}

/**
 * Load + validate JSON from KeyValueStorage.
 * Never writes the primary key on failure.
 */
export async function loadStoredJson<T>(
  storage: KeyValueStorage,
  key: string,
  fallback: T,
  validate: (parsed: unknown) => T | null,
): Promise<SafeJsonLoadResult<T>> {
  let raw: string | null = null;
  try {
    raw = await storage.getItem(key);
  } catch {
    return { value: fallback, status: 'missing', raw: null };
  }
  const result = parseStoredJson(raw, fallback, validate);
  if (result.status === 'corrupt' && result.raw != null && result.reason) {
    await quarantineCorruptValue(storage, key, result.raw, result.reason);
  }
  return result;
}
