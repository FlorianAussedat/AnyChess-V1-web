import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

export const PENDING_AVATAR_KEY = 'anychess.avatar.pending.v1';

export function avatarCacheKey(userId: string): string {
  return `anychess.avatar.cache.${userId}`;
}

export type PendingAvatarIntent = 'upload' | 'remove' | 'mascot';

export type PendingAvatar = {
  email: string;
  dataUrl: string;
  intent: PendingAvatarIntent;
  mascotId?: string;
};

export function normalizeAvatarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function savePendingAvatar(
  storage: KeyValueStorage,
  email: string,
  dataUrl: string,
  intent: PendingAvatarIntent = 'upload',
  mascotId?: string,
): Promise<void> {
  const pending: PendingAvatar = {
    email: normalizeAvatarEmail(email),
    dataUrl,
    intent,
    ...(mascotId ? { mascotId } : {}),
  };
  const update = (raw: string | null) => {
    const previous = raw ? JSON.parse(raw) as PendingAvatar & { otherAccounts?: Record<string, PendingAvatar> } : null;
    const others = { ...(previous?.otherAccounts ?? {}) };
    if (previous?.email && normalizeAvatarEmail(previous.email) !== pending.email) {
      const { otherAccounts: _, ...old } = previous;
      others[normalizeAvatarEmail(previous.email)] = old;
    }
    delete others[pending.email];
    return JSON.stringify({ ...pending, ...(Object.keys(others).length ? { otherAccounts: others } : {}) });
  };
  if (storage.updateItem) await storage.updateItem(PENDING_AVATAR_KEY, update);
  else await storage.setItem(PENDING_AVATAR_KEY, update(await storage.getItem(PENDING_AVATAR_KEY)));
}

export async function readPendingAvatar(
  storage: KeyValueStorage,
  email?: string,
): Promise<PendingAvatar | null> {
  const raw = await storage.getItem(PENDING_AVATAR_KEY);
  if (!raw) return null;
  try {
    let parsed = JSON.parse(raw) as PendingAvatar & { otherAccounts?: Record<string, PendingAvatar> };
    if (email && normalizeAvatarEmail(parsed.email ?? '') !== normalizeAvatarEmail(email)) {
      parsed = parsed.otherAccounts?.[normalizeAvatarEmail(email)] as typeof parsed;
    }
    if (!parsed || typeof parsed.email !== 'string' || typeof parsed.dataUrl !== 'string') {
      return null;
    }
    const intent =
      parsed.intent === 'remove' ? 'remove' : parsed.intent === 'mascot' ? 'mascot' : 'upload';
    if (intent === 'upload' && !parsed.dataUrl.startsWith('data:image/')) return null;
    if (intent === 'mascot' && typeof parsed.mascotId !== 'string') return null;
    return {
      email: normalizeAvatarEmail(parsed.email),
      dataUrl: parsed.dataUrl,
      intent,
      ...(typeof parsed.mascotId === 'string' ? { mascotId: parsed.mascotId } : {}),
    };
  } catch {
    return null;
  }
}

export async function clearPendingAvatar(storage: KeyValueStorage, email?: string, expected?: PendingAvatar): Promise<void> {
  const update = (raw: string | null): string | null => {
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingAvatar & { otherAccounts?: Record<string, PendingAvatar> };
    const owner = normalizeAvatarEmail(email ?? parsed.email);
    const others = { ...(parsed.otherAccounts ?? {}) };
    const target = normalizeAvatarEmail(parsed.email) === owner ? parsed : others[owner];
    if (expected && (!target || target.dataUrl !== expected.dataUrl || target.intent !== expected.intent || target.mascotId !== expected.mascotId)) return raw;
    delete others[owner];
    if (normalizeAvatarEmail(parsed.email) !== owner) return JSON.stringify({ ...parsed, otherAccounts: others });
    const [nextEmail] = Object.keys(others).sort();
    if (!nextEmail) return null;
    const next = others[nextEmail]; delete others[nextEmail];
    return JSON.stringify({ ...next, ...(Object.keys(others).length ? { otherAccounts: others } : {}) });
  };
  if (storage.updateItem) await storage.updateItem(PENDING_AVATAR_KEY, update);
  else {
    const next = update(await storage.getItem(PENDING_AVATAR_KEY));
    if (next == null) await storage.removeItem(PENDING_AVATAR_KEY); else await storage.setItem(PENDING_AVATAR_KEY, next);
  }
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
