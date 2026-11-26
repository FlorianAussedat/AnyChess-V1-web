import { isMascotId } from './mascotCatalog.ts';
import { decideCloudTransfer } from '../cloud/syncTransport.ts';
import {
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from '../cloud/supabaseConfig.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import {
  PENDING_AVATAR_KEY,
  avatarCacheKey,
  clearAvatarCache,
  clearPendingAvatar,
  normalizeAvatarEmail,
  readAvatarCache,
  readPendingAvatar,
  savePendingAvatar,
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

function storageHeaders(
  accessToken: string,
  extra?: Record<string, string>,
): Record<string, string> {
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
    const mime =
      response.headers.get('content-type')?.split(';')[0]?.trim() ||
      'image/png';
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
}): Promise<'uploaded' | 'removed' | 'skipped' | 'failed' | 'offline'> {
  const pending = await readPendingAvatar(input.storage);
  if (!pending) return 'skipped';
  if (pending.email !== normalizeAvatarEmail(input.email)) return 'skipped';
  if (pending.intent === 'mascot' && pending.mascotId) {
    if (profileStore.usesStorage(input.storage)) {
      await profileStore.update({ mascotId: pending.mascotId });
    }
    await clearPendingAvatar(input.storage);
    return 'uploaded';
  }
  const decision = await decideCloudTransfer(false);
  if (decision.offline) return 'offline';
  if (!input.accessToken) return 'failed';
  if (pending.intent === 'remove') {
    const removed = await deleteAvatarObject(
      input.userId,
      input.accessToken,
      input.fetchImpl,
    );
    if (!removed) return 'failed';
    await clearPendingAvatar(input.storage);
    if (input.markHasAvatar) await input.markHasAvatar(false);
    else if (profileStore.usesStorage(input.storage)) {
      await profileStore.update({ hasAvatar: false });
    }
    return 'removed';
  }
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
  const dataUrl = await downloadAvatarObject(
    input.userId,
    input.accessToken,
    input.fetchImpl,
  );
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

export type AvatarCommitResult =
  | 'uploaded'
  | 'removed'
  | 'offline'
  | 'stored'
  | 'sync_failed'
  | 'cancelled'
  | 'failed';

type AvatarChangeInput = {
  storage: KeyValueStorage;
  userId: string;
  email: string;
  accessToken: string | null;
  dataUrl: string | null;
  mascotId?: string;
  fetchImpl?: typeof fetch;
  cancelled?: () => boolean;
};

// Avatar edits share the existing cache/pending documents; serialize writes on this device.
const avatarWrites = new WeakMap<KeyValueStorage, Promise<unknown>>();
export async function commitAvatarChange(
  input: AvatarChangeInput,
): Promise<AvatarCommitResult> {
  const previous = avatarWrites.get(input.storage) ?? Promise.resolve();
  const work = previous
    .catch(() => {})
    .then(() => commitAvatarChangeSerial(input));
  avatarWrites.set(input.storage, work);
  try {
    return await work;
  } finally {
    if (avatarWrites.get(input.storage) === work)
      avatarWrites.delete(input.storage);
  }
}

async function commitAvatarChangeSerial(
  input: AvatarChangeInput,
): Promise<AvatarCommitResult> {
  const { storage, userId } = input;
  if (input.cancelled?.()) return 'cancelled';
  if (input.mascotId && !isMascotId(input.mascotId)) return 'failed';
  const cacheKey = avatarCacheKey(userId);
  let beforeCache: string | null;
  let beforePending: string | null;
  try {
    beforeCache = await storage.getItem(cacheKey);
    beforePending = await storage.getItem(PENDING_AVATAR_KEY);
  } catch {
    return 'failed';
  }
  const restore = async () => {
    let failure: unknown;
    try {
      if ((await storage.getItem(cacheKey)) !== beforeCache) {
        if (beforeCache == null) await storage.removeItem(cacheKey);
        else await storage.setItem(cacheKey, beforeCache);
      }
    } catch (error) {
      failure = error;
    }
    try {
      if ((await storage.getItem(PENDING_AVATAR_KEY)) !== beforePending) {
        if (beforePending == null) await storage.removeItem(PENDING_AVATAR_KEY);
        else await storage.setItem(PENDING_AVATAR_KEY, beforePending);
      }
    } catch (error) {
      failure ??= error;
    }
    if (failure) throw failure;
  };
  const ownsProfile = profileStore.usesStorage(storage);
  const previousProfile = ownsProfile ? profileStore.getProfile() : null;
  let remoteChanged = false;
  let remotePrevious = beforeCache;
  const restoreRemote = async () => {
    if (!remoteChanged || !input.accessToken) return true;
    return remotePrevious
      ? uploadAvatarObject(
          userId,
          input.accessToken,
          remotePrevious,
          input.fetchImpl,
        )
      : deleteAvatarObject(userId, input.accessToken, input.fetchImpl);
  };
  const rollback = async () => {
    const remoteRestored = await restoreRemote();
    await restore();
    if (!remoteRestored) {
      // Compensation is also a normal retry intent, scoped to the original account.
      await savePendingAvatar(
        storage,
        input.email,
        remotePrevious ?? '',
        remotePrevious ? 'upload' : 'remove',
      );
    }
    return remoteRestored;
  };
  try {
    const decision = await decideCloudTransfer(false);
    if (input.cancelled?.()) return 'cancelled';
    const intent = input.mascotId
      ? 'mascot'
      : input.dataUrl
        ? 'upload'
        : 'remove';
    // Keep a durable retry intent before replacing the cache. Failure restores both documents.
    await savePendingAvatar(
      storage,
      input.email,
      input.dataUrl ?? '',
      intent,
      input.mascotId,
    );
    if (input.dataUrl && !input.mascotId)
      await writeAvatarCache(storage, userId, input.dataUrl);
    else await clearAvatarCache(storage, userId);
    if (input.cancelled?.()) {
      await restore();
      return 'cancelled';
    }
    let result: AvatarCommitResult = decision.offline ? 'offline' : 'stored';
    if (
      intent !== 'mascot' &&
      !decision.offline &&
      input.accessToken
    ) {
      // If a previous remote photo was not cached, obtain it before any destructive replacement.
      if (!remotePrevious && previousProfile?.hasAvatar) {
        remotePrevious = await downloadAvatarObject(
          userId,
          input.accessToken,
          input.fetchImpl,
        );
        if (!remotePrevious) {
          await restore();
          return 'failed';
        }
      }
      if (input.cancelled?.()) {
        await restore();
        return 'cancelled';
      }
      const ok =
        intent === 'upload'
          ? await uploadAvatarObject(
              userId,
              input.accessToken,
              input.dataUrl!,
              input.fetchImpl,
            )
          : await deleteAvatarObject(
              userId,
              input.accessToken,
              input.fetchImpl,
            );
      remoteChanged = ok;
      if (input.cancelled?.()) {
        const restored = await rollback();
        return restored ? 'cancelled' : 'failed';
      }
      if (!ok && intent === 'remove') {
        await restore();
        return 'failed';
      }
      result = ok
        ? intent === 'upload'
          ? 'uploaded'
          : 'removed'
        : 'sync_failed';
      if (ok) await clearPendingAvatar(storage);
    }
    if (input.cancelled?.()) {
      const restored = await rollback();
      return restored ? 'cancelled' : 'failed';
    }
    // One metadata update, after durable cache/pending writes; never clear a mascot in advance.
    if (ownsProfile)
      await profileStore.update({
        hasAvatar: Boolean(input.dataUrl && !input.mascotId),
        mascotId: input.mascotId ?? null,
      });
    return result;
  } catch {
    try {
      await rollback();
    } catch {
      /* The caller displays a failure and keeps its previous avatar. */
    }
    return 'failed';
  }
}
