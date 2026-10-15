import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { DEVICE_PREFERENCES_KEY } from './syncableKeys.ts';

/** Follows the phone, not the account. Language and libraries stay with the account. */
export const DEVICE_PREFERENCE_FIELDS = ['syncOnWifiOnly'] as const;

type DeviceField = (typeof DEVICE_PREFERENCE_FIELDS)[number];

/**
 * Remember the phone's current device settings before the account document is swapped.
 * Does nothing when the active document has none of those fields.
 */
export async function captureDevicePreferences(storage: KeyValueStorage): Promise<void> {
  const raw = await storage.getItem(StorageKeys.userPreferences.key);
  if (!raw) return;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  const saved: Partial<Record<DeviceField, unknown>> = {};
  for (const field of DEVICE_PREFERENCE_FIELDS) {
    if (field in parsed) saved[field] = parsed[field];
  }
  if (Object.keys(saved).length === 0) return;
  await storage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(saved));
}

/**
 * Put the phone settings back onto the active account document.
 * Does not create a preference document, so an empty account is not given the previous account's language.
 */
export async function applyDevicePreferences(storage: KeyValueStorage): Promise<void> {
  const deviceRaw = await storage.getItem(DEVICE_PREFERENCES_KEY);
  const raw = await storage.getItem(StorageKeys.userPreferences.key);
  if (!deviceRaw || !raw) return;
  let device: Record<string, unknown>;
  let prefs: Record<string, unknown>;
  try {
    device = JSON.parse(deviceRaw) as Record<string, unknown>;
    prefs = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return;
  }
  let changed = false;
  for (const field of DEVICE_PREFERENCE_FIELDS) {
    if (!(field in device) || prefs[field] === device[field]) continue;
    prefs[field] = device[field];
    changed = true;
  }
  if (changed) await storage.setItem(StorageKeys.userPreferences.key, JSON.stringify(prefs));
}
