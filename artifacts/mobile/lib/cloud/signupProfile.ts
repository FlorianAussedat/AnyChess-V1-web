import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import type { CloudUser } from './types.ts';
export const SIGNUP_PROFILE_KEY = 'anychess.cloud.signupProfile.v1';
type Draft = { userId: string; email: string; username: string };
export async function stageSignupProfile(storage: KeyValueStorage, draft: Draft): Promise<void> {
  const update = (raw: string | null) =>
    JSON.stringify({ ...(raw ? JSON.parse(raw) : {}), [draft.userId]: draft });
  if (storage.updateItem) await storage.updateItem(SIGNUP_PROFILE_KEY, update);
  else await storage.setItem(SIGNUP_PROFILE_KEY, update(await storage.getItem(SIGNUP_PROFILE_KEY)));
}
export async function applySignupProfile(
  storage: KeyValueStorage,
  user: CloudUser,
  current: () => boolean,
): Promise<void> {
  const raw = await storage.getItem(SIGNUP_PROFILE_KEY);
  const drafts = raw ? (JSON.parse(raw) as Record<string, Draft>) : {};
  const draft = drafts[user.id];
  if (
    !draft ||
    draft.userId !== user.id ||
    draft.email.toLowerCase() !== user.email.toLowerCase() ||
    !current()
  )
    return;
  const update = (value: string | null) =>
    !current()
      ? value
      : JSON.stringify({
          ...(value ? JSON.parse(value) : {}),
          username: draft.username,
          updatedAt: new Date().toISOString(),
        });
  if (storage.updateItem) await storage.updateItem(StorageKeys.userProfile.key, update);
  else
    await storage.setItem(
      StorageKeys.userProfile.key,
      update(await storage.getItem(StorageKeys.userProfile.key))!,
    );
  if (!current()) return;
  const remove = (value: string | null) => {
    const all = value ? JSON.parse(value) : {};
    delete all[user.id];
    return JSON.stringify(all);
  };
  if (storage.updateItem) await storage.updateItem(SIGNUP_PROFILE_KEY, remove);
  else await storage.setItem(SIGNUP_PROFILE_KEY, remove(await storage.getItem(SIGNUP_PROFILE_KEY)));
}
