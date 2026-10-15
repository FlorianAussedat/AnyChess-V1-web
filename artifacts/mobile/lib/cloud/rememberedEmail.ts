import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

/** Device-only. Never a password, never a cloud document. */
export const REMEMBERED_EMAIL_KEY = 'anychess.device.rememberedEmail.v1';

export type RememberedEmail = {
  enabled: boolean;
  email: string | null;
};

export function emptyRememberedEmail(): RememberedEmail {
  return { enabled: false, email: null };
}

export async function readRememberedEmail(storage: KeyValueStorage): Promise<RememberedEmail> {
  const raw = await storage.getItem(REMEMBERED_EMAIL_KEY);
  if (!raw) return emptyRememberedEmail();
  try {
    const parsed = JSON.parse(raw) as { enabled?: unknown; email?: unknown };
    const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
    return {
      enabled: parsed.enabled === true && Boolean(email),
      email: email || null,
    };
  } catch {
    return emptyRememberedEmail();
  }
}

/** Stores the address only after a successful sign-in, and only when asked. */
export async function rememberEmailAfterSignIn(
  storage: KeyValueStorage,
  email: string,
  enabled: boolean,
): Promise<void> {
  if (!enabled) {
    await storage.removeItem(REMEMBERED_EMAIL_KEY);
    return;
  }
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    await storage.removeItem(REMEMBERED_EMAIL_KEY);
    return;
  }
  const payload: RememberedEmail = { enabled: true, email: trimmed };
  await storage.setItem(REMEMBERED_EMAIL_KEY, JSON.stringify(payload));
}

export async function clearRememberedEmail(storage: KeyValueStorage): Promise<void> {
  await storage.removeItem(REMEMBERED_EMAIL_KEY);
}
