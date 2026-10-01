import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '../cloud/supabaseConfig.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import {
  clearAvatarCache,
  clearPendingAvatar,
  normalizeAvatarEmail,
  readPendingAvatar,
  writeAvatarCache,
} from './avatarLocal.ts';
import { dataUrlToBytes } from './avatarImage.ts';
import { profileStore } from './ProfileStore.ts';

export function avatarObjectPath(userId: string): string {
  return `${userId}/avatar.png`;
}

export function avatarObjectUrl(userId: string): string | null {
  const url = resolveSupabaseUrl();
  if (!url) return null;
  return `${url.replace(/\/$/, '')}/storage/v1/object/avatars/${avatarObjectPath(userId)}`;
}

function storageHeaders(accessToken: string, extra?: Record<string, string>): Record<string, string> {
  const anon = resolveSupabaseAnonKey() ?? '';
  return {
    apikey: anon,
    Authorization: `Bearer ${accessToken}`,
    ...extra,
  };
}

/** Owner JWT only. A failed upload must not reject account creation. */
export async function uploadAvatarObject(
  userId: string,
  accessToken: string,
  dataUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const target = avatarObjectUrl(userId);
  const decoded = dataUrlToBytes(dataUrl);
  if (!target || !accessToken.trim() || !decoded) return false;
  try {
    const response = await fetchImpl(target, {
      method: 'POST',
      headers: storageHeaders(accessToken, {
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'cache-control': '3600',
      }),
      body: decoded.bytes as BodyInit,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function deleteAvatarObject(
  userId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const target = avatarObjectUrl(userId);
  if (!target || !accessToken.trim()) return false;
  try {
    const response = await fetchImpl(target, {
      method: 'DELETE',
      headers: storageHeaders(accessToken),
    });
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

export async function downloadAvatarObject(
  userId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const target = avatarObjectUrl(userId);
  if (!target || !accessToken.trim()) return null;
  try {
    const response = await fetchImpl(target, {
      method: 'GET',
      headers: storageHeaders(accessToken),
    });
    if (!response.ok) return null;
    const mime = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let bin = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/**
 * After a real session exists, send the photo chosen before email confirmation.
 * Failure leaves the pending image on the device and does not throw.
 */
export async function flushPendingAvatar(input: {
  storage: KeyValueStorage;
  userId: string;
  email: string;
  accessToken: string | null;
  fetchImpl?: typeof fetch;
  markHasAvatar?: (hasAvatar: boolean) => Promise<void>;
}): Promise<'uploaded' | 'skipped' | 'failed'> {
  const pending = await readPendingAvatar(input.storage);
  if (!pending) return 'skipped';
  if (pending.email !== normalizeAvatarEmail(input.email)) return 'skipped';
  if (!input.accessToken) return 'failed';
  const ok = await uploadAvatarObject(
    input.userId,
    input.accessToken,
    pending.dataUrl,
    input.fetchImpl,
  );
  if (!ok) return 'failed';
  await writeAvatarCache(input.storage, input.userId, pending.dataUrl);
  await clearPendingAvatar(input.storage);
  if (input.markHasAvatar) await input.markHasAvatar(true);
  else if (profileStore.usesStorage(input.storage)) {
    await profileStore.update({ hasAvatar: true });
  }
  return 'uploaded';
}

export async function cacheRemoteAvatar(input: {
  storage: KeyValueStorage;
  userId: string;
  accessToken: string | null;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  if (!input.accessToken) return null;
  const dataUrl = await downloadAvatarObject(input.userId, input.accessToken, input.fetchImpl);
  if (!dataUrl) return null;
  await writeAvatarCache(input.storage, input.userId, dataUrl);
  return dataUrl;
}

export async function removeLocalAndRemoteAvatar(input: {
  storage: KeyValueStorage;
  userId: string;
  accessToken: string | null;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  await clearAvatarCache(input.storage, input.userId);
  await clearPendingAvatar(input.storage);
  if (profileStore.usesStorage(input.storage)) {
    await profileStore.update({ hasAvatar: false });
  }
  if (!input.accessToken) return true;
  return deleteAvatarObject(input.userId, input.accessToken, input.fetchImpl);
}
