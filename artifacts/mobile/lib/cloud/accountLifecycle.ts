import { authRequest } from './authRequest.ts';
import { flushPendingAvatar } from '../profile/avatarRemote.ts';
import { pgnTranslationQueue } from '../pgnComments/PgnTranslationQueue.ts';
import type { CloudSyncEngine } from './CloudSyncEngine.ts';
import {
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
import { decideCloudTransfer } from './syncTransport.ts';
import {
  deleteAccountFunctionUrl,
  resolveSupabaseAnonKey,
  resolveSupabaseUrl,
} from './supabaseConfig.ts';

export type DeleteAccountResult =
  | { ok: true; alreadyCleaned?: boolean }
  | {
      ok: false;
      error:
        | 'uncertain'
        | 'reauth_failed'
        | 'failed'
        | 'offline'
        | 'signed_out'
        | 'unconfigured'
        | 'unavailable'
        | 'session_expired';
    };

async function defaultDeleteRequest(accessToken: string, password: string): Promise<DeletionHttp> {
  const target = deleteAccountFunctionUrl();
  const anon = resolveSupabaseAnonKey();
  if (!target || !anon) return { status: 0, body: '{"error":"unconfigured"}' };
  try {
    return await authRequest(async (signal) => {
      const response = await fetch(target, {
        signal,
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
    });
  } catch {
    return 'network';
  }
}

async function defaultProbe(engine: CloudSyncEngine): Promise<AccountProbe> {
  // Auth owns refresh-token rotation and durable session persistence.
  return engine.probeAuthAccount();
}

const deletionFlights = new WeakMap<CloudSyncEngine, Promise<DeleteAccountResult>>();
export function performAccountDeletion(
  engine: CloudSyncEngine,
  password: string,
  deps?: Parameters<typeof performAccountDeletionOnce>[2],
): Promise<DeleteAccountResult> {
  const previous = deletionFlights.get(engine);
  if (previous) return previous;
  const work = performAccountDeletionOnce(engine, password, deps).catch((): DeleteAccountResult => {
    engine.releaseAccountDeletion();
    engine.noteDeletionUncertain();
    return { ok: false, error: 'failed' };
  });
  const wrapped = work.finally(() => {
    if (deletionFlights.get(engine) === wrapped) deletionFlights.delete(engine);
  });
  deletionFlights.set(engine, wrapped);
  return wrapped;
}

async function performAccountDeletionOnce(
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

  const link = await decideCloudTransfer(false);
  if (link.offline) return { ok: false, error: 'offline' };

  if (engine.getState().user?.id !== user.id) return { ok: false, error: 'signed_out' };
  await engine.quiesceForAccountDeletion();
  const current = engine.sessionGuard();
  const heldJobs = pgnTranslationQueue.holdForAccountDeletion();
  try {
    await writeDeletionPending(engine.storageHandle(), { userId: user.id, email: user.email });
    if (!current()) return { ok: false, error: 'signed_out' };
    const request = deps?.request ?? defaultDeleteRequest;
    const http = await request(accessToken, password).catch(() => 'network' as const);
    if (!current() || engine.getState().user?.id !== user.id) {
      if (decideDeletionOutcome(http) === 'wipe') {
        await engine.wipeDeletedAccount(user.id);
        return { ok: true };
      }
      return { ok: false, error: 'signed_out' };
    }
    let probe: AccountProbe | undefined;
    if (http === 'network' || http.status >= 500 || http.status === 0)
      probe = await (deps?.probe ?? defaultProbe)(engine).catch(() => 'unknown' as const);
    if (!current()) return { ok: false, error: 'signed_out' };
    const decision = decideDeletionOutcome(http, probe);
    if (decision === 'wipe') {
      await engine.wipeDeletedAccount(user.id);
      pgnTranslationQueue.discardHeldWork();
      await pgnTranslationQueue.reloadFromStorage();
      return { ok: true, alreadyCleaned: false };
    }
    if (decision === 'keep') await clearDeletionPending(engine.storageHandle());
    else {
      engine.noteDeletionUncertain();
      return { ok: false, error: 'uncertain' };
    }
    const error = deletionErrorCode(decision, http);
    if (
      error === 'reauth_failed' ||
      error === 'offline' ||
      error === 'unavailable' ||
      error === 'session_expired'
    )
      return { ok: false, error };
    return { ok: false, error: 'failed' };
  } finally {
    if (engine.getState().user?.id === user.id) pgnTranslationQueue.releaseDeletionHold(heldJobs);
    engine.releaseAccountDeletion();
    if (current() && engine.getState().user && !(await readDeletionPending(engine.storageHandle())))
      engine.scheduleSync(50);
  }
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
  const current = engine.sessionGuard();
  let verdict: AccountProbe = 'unknown';
  try {
    verdict = await probe(engine);
  } catch {
    /* keep marker */
  }
  if (!current()) {
    engine.releaseAccountDeletion();
    return;
  }
  if (verdict === 'gone') {
    await engine.wipeDeletedAccount(pending.userId);
    pgnTranslationQueue.discardHeldWork();
    await pgnTranslationQueue.reloadFromStorage();
    return;
  }
  engine.releaseAccountDeletion();
  if (verdict === 'exists') await clearDeletionPending(engine.storageHandle());
  else engine.noteDeletionUncertain();
}

export async function settleAccountLifecycle(engine: CloudSyncEngine): Promise<void> {
  await resumePendingAccountDeletion(engine);
  const user = engine.getState().user;
  if (!user || engine.isAccountDeletionLocked()) return;
  const token = engine.getAccessToken();
  try {
    const avatarResult = await flushPendingAvatar({
      isCurrent: engine.sessionGuard(),
      storage: engine.storageHandle(),
      userId: user.id,
      email: user.email,
      accessToken: token,
    });
    if (engine.getState().user?.id !== user.id) return;
    if (avatarResult === 'offline') engine.markOffline();
    if (avatarResult === 'failed') engine.noteAvatarTransferFailure();
  } catch {
    // Keep the retry intent and expose the transfer failure.
    if (engine.getState().user?.id === user.id) engine.noteAvatarTransferFailure();
  }
}
