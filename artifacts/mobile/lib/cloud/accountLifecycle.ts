import { flushPendingAvatar } from '../profile/avatarRemote.ts';
import { pgnTranslationQueue } from '../pgnComments/PgnTranslationQueue.ts';
import type { CloudSyncEngine } from './CloudSyncEngine.ts';
import {
  classifyAuthProbe,
  decideDeletionOutcome,
  deletionErrorCode,
  type AccountProbe,
  type DeletionHttp,
} from './deletionDecision.ts';
import {
  clearDeletionPending,
  readDeletionPending,
  writeDeletionPending,
} from './purgeAccountLocal.ts';
import { deleteAccountFunctionUrl, resolveSupabaseAnonKey, resolveSupabaseUrl } from './supabaseConfig.ts';

export type DeleteAccountResult =
  | { ok: true; alreadyCleaned?: boolean }
  | { ok: false; error: 'reauth_failed' | 'failed' | 'offline' | 'signed_out' | 'unconfigured' };

async function defaultDeleteRequest(
  accessToken: string,
  password: string,
): Promise<DeletionHttp> {
  const target = deleteAccountFunctionUrl();
  const anon = resolveSupabaseAnonKey();
  if (!target || !anon) return { status: 0, body: '{"error":"unconfigured"}' };
  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ password }),
    });
    const body = await response.text();
    return { status: response.status, body };
  } catch {
    return 'network';
  }
}

async function defaultProbe(engine: CloudSyncEngine): Promise<AccountProbe> {
  const url = resolveSupabaseUrl();
  const anon = resolveSupabaseAnonKey();
  const refreshToken = await engine.readRefreshToken();
  if (!url || !anon || !refreshToken) return 'unknown';
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const body = await response.text();
    return classifyAuthProbe(response.status, body, false);
  } catch {
    return 'unknown';
  }
}

export async function performAccountDeletion(
  engine: CloudSyncEngine,
  password: string,
  deps?: {
    request?: (accessToken: string, password: string) => Promise<DeletionHttp>;
    probe?: (engine: CloudSyncEngine) => Promise<AccountProbe>;
  },
): Promise<DeleteAccountResult> {
  const user = engine.getState().user;
  if (!user) return { ok: false, error: 'signed_out' };
  const accessToken = engine.getAccessToken();
  if (!accessToken) return { ok: false, error: 'unconfigured' };

  engine.beginAccountDeletion();
  const heldJobs = pgnTranslationQueue.holdForAccountDeletion();
  await writeDeletionPending(engine.storageHandle(), { userId: user.id, email: user.email });

  const request = deps?.request ?? defaultDeleteRequest;
  const http = await request(accessToken, password);
  let probe: AccountProbe | undefined;
  if (http === 'network' || http.status >= 500) {
    probe = await (deps?.probe ?? defaultProbe)(engine);
  }
  const decision = decideDeletionOutcome(http, probe);
  if (decision === 'wipe') {
    await engine.wipeDeletedAccount(user.id);
    pgnTranslationQueue.discardHeldWork();
    await pgnTranslationQueue.reloadFromStorage();
    return { ok: true, alreadyCleaned: http === 'network' };
  }
  pgnTranslationQueue.releaseDeletionHold(heldJobs);
  engine.releaseAccountDeletion();
  if (decision === 'keep') await clearDeletionPending(engine.storageHandle());
  const error = deletionErrorCode(decision, http);
  if (error === 'reauth_failed') return { ok: false, error: 'reauth_failed' };
  if (error === 'offline') return { ok: false, error: 'offline' };
  return { ok: false, error: 'failed' };
}

/** Finish a deletion whose HTTP response never arrived, once we know the account is gone. */
export async function resumePendingAccountDeletion(
  engine: CloudSyncEngine,
  probe: (engine: CloudSyncEngine) => Promise<AccountProbe> = defaultProbe,
): Promise<void> {
  const pending = await readDeletionPending(engine.storageHandle());
  if (!pending) return;
  const active = engine.getState().user?.id;
  if (active && active !== pending.userId) return;
  engine.beginAccountDeletion();
  const verdict = await probe(engine);
  if (verdict === 'gone') {
    await engine.wipeDeletedAccount(pending.userId);
    pgnTranslationQueue.discardHeldWork();
    await pgnTranslationQueue.reloadFromStorage();
    return;
  }
  engine.releaseAccountDeletion();
  if (verdict === 'exists') await clearDeletionPending(engine.storageHandle());
}

export async function settleAccountLifecycle(engine: CloudSyncEngine): Promise<void> {
  await resumePendingAccountDeletion(engine);
  const user = engine.getState().user;
  if (!user || engine.isAccountDeletionLocked()) return;
  const token = engine.getAccessToken();
  try {
    await flushPendingAvatar({
      storage: engine.storageHandle(),
      userId: user.id,
      email: user.email,
      accessToken: token,
    });
  } catch {
    // The account already exists. The photo can be sent on the next sign-in.
  }
}
