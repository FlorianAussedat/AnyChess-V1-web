import { stageSignupProfile } from '../cloud/signupProfile.ts';
import { validAuthEmail } from '../cloud/authRequest.ts';
import { savePendingAvatar } from './avatarLocal.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';

export type CreateAccountResult = {
  ok: boolean;
  error?: string;
  retryAfterSeconds?: number;
  pendingUserId?: string;
};

/**
 * Profile drafts are attached only to a server-confirmed new identity. The password is only forwarded to auth and never stored.
 */
export async function submitCreateAccount(input: {
  username: string;
  email: string;
  password: string;
  avatarDataUrl: string | null;
  mascotId?: string | null;
  storage: KeyValueStorage;
  updateUsername: (username: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<CreateAccountResult>;
  abandoned?: () => boolean;
}): Promise<CreateAccountResult> {
  const username = input.username.trim();
  if (!username) return { ok: false, error: 'username_required' };
  const email = input.email.trim();
  if (!validAuthEmail(email)) return { ok: false, error: 'email_invalid' };
  if (input.password.length < 6) return { ok: false, error: 'weak_password' };
  if (input.abandoned?.()) return { ok: false, error: 'unexpected' };
  try {
    const result = await input.signUp(email, input.password);
    if (input.abandoned?.()) return { ok: false, error: 'unexpected' };
    if (!result.ok && (result.error !== 'confirm_email' || !result.pendingUserId)) return result;
    if (result.ok) await input.updateUsername(username);
    else
      await stageSignupProfile(input.storage, {
        userId: result.pendingUserId!,
        email: email.toLowerCase(),
        username,
      });
    if (input.abandoned?.()) return { ok: false, error: 'unexpected' };
    if (input.mascotId) await savePendingAvatar(input.storage, email, '', 'mascot', input.mascotId);
    else if (input.avatarDataUrl?.startsWith('data:image/'))
      await savePendingAvatar(input.storage, email, input.avatarDataUrl);
    return result;
  } catch {
    return { ok: false, error: 'local_save_failed' };
  }
}
