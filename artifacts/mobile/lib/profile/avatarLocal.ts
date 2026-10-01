import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

export const PENDING_AVATAR_KEY = 'anychess.avatar.pending.v1';

export function avatarCacheKey(userId: string): string {
  return `anychess.avatar.cache.${userId}`;
}

export type PendingAvatar = {
  email: string;
  dataUrl: string;
};

export function normalizeAvatarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function savePendingAvatar(
  storage: KeyValueStorage,
  email: string,
  dataUrl: string,
): Promise<void> {
  const pending: PendingAvatar = {
    email: normalizeAvatarEmail(email),
    dataUrl,
  };
  await storage.setItem(PENDING_AVATAR_KEY, JSON.stringify(pending));
}

export async function readPendingAvatar(
  storage: KeyValueStorage,
): Promise<PendingAvatar | null> {
  const raw = await storage.getItem(PENDING_AVATAR_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingAvatar;
    if (!parsed || typeof parsed.email !== 'string' || typeof parsed.dataUrl !== 'string') {
      return null;
    }
    if (!parsed.dataUrl.startsWith('data:image/')) return null;
    return { email: normalizeAvatarEmail(parsed.email), dataUrl: parsed.dataUrl };
  } catch {
    return null;
  }
}

export async function clearPendingAvatar(storage: KeyValueStorage): Promise<void> {
  await storage.removeItem(PENDING_AVATAR_KEY);
}

export async function readAvatarCache(
  storage: KeyValueStorage,
  userId: string,
): Promise<string | null> {
  const raw = await storage.getItem(avatarCacheKey(userId));
  if (!raw || !raw.startsWith('data:image/')) return null;
  return raw;
}

export async function writeAvatarCache(
  storage: KeyValueStorage,
  userId: string,
  dataUrl: string,
): Promise<void> {
  await storage.setItem(avatarCacheKey(userId), dataUrl);
}

export async function clearAvatarCache(
  storage: KeyValueStorage,
  userId: string,
): Promise<void> {
  await storage.removeItem(avatarCacheKey(userId));
}
