import { savePendingAvatar } from './avatarLocal.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

export type CreateAccountResult = {
  ok: boolean;
  error?: string;
};

/**
 * Pseudo is written to the profile document before sign-up so the parked
 * workspace keeps it. The password is only forwarded to auth and never stored.
 */
export async function submitCreateAccount(input: {
  username: string;
  email: string;
  password: string;
  avatarDataUrl: string | null;
  storage: KeyValueStorage;
  updateUsername: (username: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<CreateAccountResult>;
}): Promise<CreateAccountResult> {
  const username = input.username.trim();
  if (!username) return { ok: false, error: 'username_required' };
  const email = input.email.trim();
  if (!email || !input.password) return { ok: false, error: 'invalid_credentials' };
  await input.updateUsername(username);
  if (input.avatarDataUrl?.startsWith('data:image/')) {
    await savePendingAvatar(input.storage, email, input.avatarDataUrl);
  }
  return input.signUp(email, input.password);
}
