import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { SupabaseCloudAuth, SupabaseCloudRemote } from '../SupabaseCloud.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { authRequest, AuthTimeoutError, validAuthEmail } from '../authRequest.ts';
import { performAccountDeletion, resumePendingAccountDeletion } from '../accountLifecycle.ts';
import { classifyAuthProbe, decideDeletionOutcome } from '../deletionDecision.ts';
import { readDeletionPending } from '../purgeAccountLocal.ts';
import { submitCreateAccount } from '../../profile/createAccount.ts';
import { applySignupProfile, SIGNUP_PROFILE_KEY } from '../signupProfile.ts';
import { readPendingAvatar } from '../../profile/avatarLocal.ts';
import { consumeAuthReturn, setAuthReturn } from '../authReturn.ts';
import type { CloudSession } from '../types.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
const originalFetch = globalThis.fetch;
const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL,
  previousAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-fixture';
  setCloudTransferReadersForTests({ transport: async () => 'wifi' });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
  if (previousAnon === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
  setCloudTransferReadersForTests({ transport: null });
});
const gate = () => {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
};
const success = (id = 'A') =>
  Response.json({
    access_token: `${id}-access`,
    refresh_token: `${id}-refresh`,
    user: { id, email: `${id.toLowerCase()}@example.com` },
  });
function authFixture() {
  let saved: CloudSession | null = null;
  const auth = new SupabaseCloudAuth({
    load: async () => saved,
    save: async (next) => {
      saved = next;
    },
  });
  return { auth, read: () => saved };
}

describe('authentication requests and persistence', () => {
  it('validates email without a request and leaves the previous session alone', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return success();
    };
    const { auth } = authFixture();
    for (const email of ['', 'a@', 'a b@example.com', '//evil'])
      assert.equal((await auth.signIn(email, 'secret1')).ok, false);
    assert.equal(calls, 0);
    assert.equal(validAuthEmail('ada@example.com'), true);
  });
  it('publishes only a durable session and never stores the password', async () => {
    globalThis.fetch = async () => success();
    const hold = gate();
    let saved: CloudSession | null = null;
    const auth = new SupabaseCloudAuth({
      load: async () => null,
      save: async (next) => {
        await hold.promise;
        saved = next;
      },
    });
    const login = auth.signIn('a@example.com', 'not-in-storage');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(await auth.getUser(), null);
    assert.equal(auth.token(), null);
    hold.release();
    assert.equal((await login).ok, true);
    assert.equal((saved as CloudSession | null)?.user.id, 'A');
    assert.doesNotMatch(JSON.stringify(saved), /not-in-storage/);
  });
  it('reports a local persistence failure without a connected in-memory account', async () => {
    globalThis.fetch = async () => success();
    const auth = new SupabaseCloudAuth({
      load: async () => null,
      save: async () => {
        throw Error('disk full');
      },
    });
    assert.deepEqual(await auth.signIn('a@example.com', 'secret1'), {
      ok: false,
      error: 'local_save_failed',
    });
    assert.equal(auth.token(), null);
  });
  it('ignores a response after the form has been abandoned, including durable storage', async () => {
    const hold = gate(),
      started = gate();
    let abandoned = false;
    globalThis.fetch = async () => {
      started.release();
      await hold.promise;
      return success();
    };
    const { auth, read } = authFixture();
    const request = auth.signIn('a@example.com', 'secret1', { abandoned: () => abandoned });
    await started.promise;
    abandoned = true;
    hold.release();
    assert.equal((await request).ok, false);
    assert.equal(read(), null);
    assert.equal(await auth.getUser(), null);
  });
  it('undoes a session write if abandonment occurs while storage is committing', async () => {
    const hold = gate(),
      entered = gate();
    let abandoned = false,
      saved: CloudSession | null = null;
    globalThis.fetch = async () => success();
    const auth = new SupabaseCloudAuth({
      load: async () => saved,
      save: async (next) => {
        if (next) {
          entered.release();
          await hold.promise;
        }
        saved = next;
      },
    });
    const login = auth.signIn('a@example.com', 'secret1', { abandoned: () => abandoned });
    await entered.promise;
    abandoned = true;
    hold.release();
    assert.equal((await login).ok, false);
    assert.equal(saved, null);
    assert.equal(auth.token(), null);
  });
  it('does not let an older login overwrite B after sign-out and a new login', async () => {
    const hold = gate(),
      started = gate();
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body ?? '{}'));
      if (body.email === 'a@example.com') {
        started.release();
        await hold.promise;
        return success('A');
      }
      return success('B');
    };
    const { auth, read } = authFixture();
    const a = auth.signIn('a@example.com', 'secret1');
    await started.promise;
    await auth.signOut();
    assert.equal((await auth.signIn('b@example.com', 'secret1')).ok, true);
    hold.release();
    assert.equal((await a).ok, false);
    assert.equal((await auth.getUser())?.id, 'B');
    assert.equal(read()?.user.id, 'B');
  });
  it('bounds a stalled fetch and its late completion cannot publish a session', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const hold = gate();
    globalThis.fetch = async () => {
      await hold.promise;
      return success();
    };
    const { auth, read } = authFixture();
    const login = auth.signIn('a@example.com', 'secret1');
    t.mock.timers.tick(20_001);
    const result = await login;
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'timeout');
    hold.release();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(read(), null);
  });
  it('bounds the response body as well as fetch', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let aborted = false;
    const request = authRequest(async (signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return new Promise<never>(() => {});
    }, 10);
    const failed = assert.rejects(request, AuthTimeoutError);
    t.mock.timers.tick(11);
    await failed;
    assert.equal(aborted, true);
  });
  it('distinguishes invalid credentials, confirmation, service outage and offline', async () => {
    const { auth } = authFixture();
    for (const [status, body, expected] of [
      [400, { error_code: 'invalid_credentials' }, 'invalid_credentials'],
      [400, { error_code: 'email_not_confirmed' }, 'email_not_confirmed'],
      [503, {}, 'service_unavailable'],
    ] as const) {
      globalThis.fetch = async () => Response.json(body, { status });
      const result = await auth.signIn('a@example.com', 'secret1');
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.error, expected);
    }
    globalThis.fetch = async () => {
      throw Error('network');
    };
    const result = await auth.signIn('a@example.com', 'secret1');
    if (!result.ok) assert.equal(result.error, 'offline');
  });
  it('restores a saved session without requiring the network', async () => {
    const session = {
      accessToken: 'saved-access',
      refreshToken: 'saved-refresh',
      user: { id: 'A', email: 'a@example.com' },
    };
    globalThis.fetch = async () => {
      assert.fail('hydration must be local');
    };
    const auth = new SupabaseCloudAuth({ load: async () => session, save: async () => {} });
    assert.equal((await auth.hydrate())?.id, 'A');
  });
  it('refreshes an expired token and retries the HTTP request under the same owner', async () => {
    let session: CloudSession = {
      accessToken: 'old',
      refreshToken: 'refresh',
      user: { id: 'A', email: 'a@example.com' },
    };
    const auth = new SupabaseCloudAuth({
      load: async () => session,
      save: async (next) => {
        if (next) session = next;
      },
    });
    await auth.hydrate();
    let reads = 0;
    globalThis.fetch = async (url) => {
      if (String(url).includes('grant_type=refresh_token')) return success();
      reads++;
      return reads === 1
        ? Response.json({ message: 'JWT expired' }, { status: 401 })
        : Response.json([]);
    };
    assert.deepEqual(await new SupabaseCloudRemote(auth).listDocuments('A'), []);
    assert.equal(reads, 2);
    assert.equal(session.accessToken, 'A-access');
  });
  it('coalesces double sign-in submissions in the complete engine', async () => {
    const hold = gate(),
      entered = gate();
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      entered.release();
      await hold.promise;
      return success();
    };
    const { auth } = authFixture();
    const engine = new CloudSyncEngine(new MemoryKeyValueStorage(), auth, new MemoryCloudRemote());
    const one = engine.signIn('a@example.com', 'secret1'),
      two = engine.signIn('a@example.com', 'secret1');
    await entered.promise;
    assert.equal(calls, 1);
    hold.release();
    assert.equal((await one).ok, true);
    assert.equal((await two).ok, true);
  });
});

describe('signup identity and return destination', () => {
  it('leaves profile and avatar untouched for rejected and ambiguous signup responses', async () => {
    const storage = new MemoryKeyValueStorage();
    let updates = 0;
    for (const error of ['email_taken', 'signup_ambiguous', 'service_unavailable']) {
      const result = await submitCreateAccount({
        username: 'Demo',
        email: 'a@example.com',
        password: 'secret1',
        avatarDataUrl: 'data:image/png;base64,QQ==',
        storage,
        updateUsername: async () => {
          updates++;
        },
        signUp: async () => ({ ok: false, error }),
      });
      assert.equal(result.error, error);
    }
    assert.equal(updates, 0);
    assert.equal(await readPendingAvatar(storage), null);
    assert.equal(await storage.getItem(SIGNUP_PROFILE_KEY), null);
  });
  it('binds the confirmation profile to the server identity and applies it only after matching sign-in', async () => {
    const storage = new MemoryKeyValueStorage();
    await submitCreateAccount({
      username: 'Demo',
      email: 'a@example.com',
      password: 'secret1',
      avatarDataUrl: null,
      storage,
      updateUsername: async () => assert.fail('guest profile must not be changed'),
      signUp: async () => ({ ok: false, error: 'confirm_email', pendingUserId: 'A' }),
    });
    await applySignupProfile(storage, { id: 'B', email: 'b@example.com' }, () => true);
    assert.equal(await storage.getItem(StorageKeys.userProfile.key), null);
    await applySignupProfile(storage, { id: 'A', email: 'a@example.com' }, () => true);
    assert.equal(
      JSON.parse((await storage.getItem(StorageKeys.userProfile.key))!).username,
      'Demo',
    );
    assert.doesNotMatch((await storage.getItem(SIGNUP_PROFILE_KEY))!, /secret1/);
  });
  it('keeps an abandoned signup out of all local profile and avatar documents', async () => {
    const storage = new MemoryKeyValueStorage();
    let abandoned = false;
    const result = await submitCreateAccount({
      username: 'Demo',
      email: 'a@example.com',
      password: 'secret1',
      avatarDataUrl: 'data:image/png;base64,QQ==',
      storage,
      abandoned: () => abandoned,
      updateUsername: async () => assert.fail(),
      signUp: async () => {
        abandoned = true;
        return { ok: true };
      },
    });
    assert.equal(result.ok, false);
    assert.deepEqual(await storage.getAllKeys(), []);
  });
  it('accepts an internal return once and rejects external URLs, tokens and authentication loops', () => {
    for (const bad of [
      'https://example.com',
      '//example.com',
      '/creer-compte',
      '/utilisateur',
      '/parties?access_token=secret',
    ]) {
      setAuthReturn(bad);
      assert.equal(consumeAuthReturn(), null);
    }
    setAuthReturn('/parametres');
    assert.equal(consumeAuthReturn(), '/parametres');
    assert.equal(consumeAuthReturn(), null);
  });
});

class TokenAuth extends MemoryCloudAuth {
  token() {
    return 'fixture-access';
  }
}
async function connected(remote = new MemoryCloudRemote()) {
  const storage = new MemoryKeyValueStorage(),
    auth = new TokenAuth(),
    engine = new CloudSyncEngine(storage, auth, remote);
  await engine.signUp('a@example.com', 'secret1');
  return { storage, engine, auth };
}
describe('deletion confirmation, uncertain results and account boundaries', () => {
  it('never treats an isolated 401, a 500 message or a false success flag as deletion proof', () => {
    assert.equal(classifyAuthProbe(401, '{"message":"JWT expired"}', false), 'unknown');
    assert.equal(classifyAuthProbe(500, '{"code":"user_not_found"}', false), 'unknown');
    assert.equal(decideDeletionOutcome({ status: 401, body: '{"alreadyDeleted":true}' }), 'keep');
    assert.equal(decideDeletionOutcome({ status: 200, body: '{}' }), 'keep');
    assert.equal(decideDeletionOutcome({ status: 200, body: '{"ok":true}' }), 'wipe');
  });
  it('keeps data and a durable marker after network interruption and blocks document uploads', async () => {
    const remote = new MemoryCloudRemote(),
      { engine, storage } = await connected(remote);
    await storage.setItem(StorageKeys.userProfile.key, '{"username":"Keep"}');
    const result = await performAccountDeletion(engine, 'secret1', {
      request: async () => 'network',
      probe: async () => 'unknown',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'uncertain');
    assert.ok(await readDeletionPending(storage));
    let pushes = 0;
    remote.upsertDocument = async () => {
      pushes++;
    };
    await engine.sync();
    assert.equal(pushes, 0);
    assert.match((await storage.getItem(StorageKeys.userProfile.key))!, /Keep/);
    await resumePendingAccountDeletion(engine, async () => 'gone');
    assert.equal(engine.getState().user, null);
    assert.equal(await readDeletionPending(storage), null);
  });
  it('coalesces double deletion and keeps the account on failed password verification', async () => {
    const { engine, storage } = await connected();
    const hold = gate(),
      entered = gate();
    let calls = 0;
    const deps = {
      request: async () => {
        calls++;
        entered.release();
        await hold.promise;
        return { status: 401, body: '{"error":"reauth_failed"}' };
      },
    };
    const a = performAccountDeletion(engine, 'bad', deps),
      b = performAccountDeletion(engine, 'bad', deps);
    await entered.promise;
    assert.equal(calls, 1);
    hold.release();
    await Promise.all([a, b]);
    assert.ok(engine.getState().user);
    assert.equal(await readDeletionPending(storage), null);
  });
  it('waits for an existing upload to settle before sending the deletion request', async () => {
    const remote = new MemoryCloudRemote(),
      { engine, storage } = await connected(remote);
    const entered = gate(),
      release = gate();
    let blocked = true;
    const write = remote.upsertDocument.bind(remote);
    remote.upsertDocument = async (owner, doc) => {
      if (blocked) {
        entered.release();
        await release.promise;
      }
      await write(owner, doc);
    };
    await storage.setItem(StorageKeys.userProfile.key, '{"username":"Keep"}');
    const sync = engine.sync();
    await entered.promise;
    let requested = false;
    const deletion = performAccountDeletion(engine, 'secret1', {
      request: async () => {
        requested = true;
        return { status: 401, body: '{"error":"reauth_failed"}' };
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(requested, false);
    blocked = false;
    release.release();
    await sync;
    await deletion;
    assert.equal(requested, true);
  });
  it('keeps B visible and untouched when the response for deletion of A arrives late', async () => {
    const { engine, storage } = await connected();
    const entered = gate(),
      release = gate();
    const deleting = performAccountDeletion(engine, 'secret1', {
      request: async () => {
        entered.release();
        await release.promise;
        return { status: 200, body: '{"ok":true}' };
      },
    });
    await entered.promise;
    await engine.signOut();
    const b = await engine.signUp('b@example.com', 'secret2');
    assert.equal(b.ok, true);
    await storage.setItem(StorageKeys.userProfile.key, '{"username":"B"}');
    release.release();
    await deleting;
    assert.equal(engine.getState().user?.email, 'b@example.com');
    assert.match((await storage.getItem(StorageKeys.userProfile.key))!, /B/);
  });
});

it('persists refresh-token rotation while verifying an uncertain deletion', async () => {
  let session: CloudSession = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    user: { id: 'A', email: 'a@example.com' },
  };
  const auth = new SupabaseCloudAuth({
    load: async () => session,
    save: async (next) => {
      if (next) session = next;
    },
  });
  await auth.hydrate();
  let reads = 0;
  globalThis.fetch = async (url) => {
    if (String(url).includes('grant_type=refresh_token')) return success('A');
    reads++;
    return reads === 1
      ? Response.json({ message: 'JWT expired' }, { status: 401 })
      : Response.json({ id: 'A' });
  };
  assert.equal(await auth.probeAccount(), 'exists');
  assert.equal(session.refreshToken, 'A-refresh');
  assert.equal(session.accessToken, 'A-access');
});
it('shares a single token refresh across concurrent authenticated requests', async () => {
  let session: CloudSession = {
    accessToken: 'old-access',
    refreshToken: 'old-refresh',
    user: { id: 'A', email: 'a@example.com' },
  };
  const auth = new SupabaseCloudAuth({
    load: async () => session,
    save: async (next) => {
      if (next) session = next;
    },
  });
  await auth.hydrate();
  let calls = 0;
  const entered = gate(),
    resume = gate();
  globalThis.fetch = async () => {
    calls++;
    entered.release();
    await resume.promise;
    return success('A');
  };
  const first = auth.refreshSession(),
    second = auth.refreshSession();
  await entered.promise;
  assert.equal(calls, 1);
  resume.release();
  assert.deepEqual(await Promise.all([first, second]), [true, true]);
});
it('does not let a delayed startup hydration replace a newer account', async () => {
  const storage = new MemoryKeyValueStorage(),
    hold = gate(),
    entered = gate();
  const auth = new MemoryCloudAuth();
  auth.hydrate = async () => {
    entered.release();
    await hold.promise;
    return null;
  };
  const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
  const hydrate = engine.hydrate();
  await entered.promise;
  await engine.signUp('b@example.com', 'secret1');
  hold.release();
  await hydrate;
  assert.equal(engine.getState().user?.email, 'b@example.com');
});
it('discards account A translation caches when switching to B, and restores A from its own workspace', async () => {
  const { defaultKeyValueStorage } = await import('../../storage/AsyncKeyValueStorage.ts');
  const { pgnTranslationQueue } = await import('../../pgnComments/PgnTranslationQueue.ts');
  const { pgnCommentTranslationStore } =
    await import('../../pgnComments/PgnCommentTranslationStore.ts');
  const auth = new MemoryCloudAuth(),
    remote = new MemoryCloudRemote();
  const engine = new CloudSyncEngine(defaultKeyValueStorage, auth, remote);
  await engine.signUp('a@example.com', 'secret1');
  const anchor = {
    source: 'repertoire' as const,
    fileId: 'account-A-study',
    gameIndex: 0,
    nodeId: 'root',
    slot: 'after' as const,
  };
  await pgnCommentTranslationStore.saveManual(
    anchor,
    'A strong central pawn.',
    'Un pion central fort.',
  );
  await pgnTranslationQueue.enqueuePgn(
    '1. e4 {A strong central pawn.} *',
    'repertoire',
    'account-A-job',
    'catchup',
  );
  assert.ok(Object.keys(pgnTranslationQueue.getSnapshot().jobs).length);
  await engine.signOut();
  await engine.signUp('b@example.com', 'secret2');
  assert.equal(pgnCommentTranslationStore.getRecord(anchor), undefined);
  await pgnTranslationQueue.ensureLoaded();
  assert.doesNotMatch(JSON.stringify(pgnTranslationQueue.getSnapshot()), /account-A/);
  await engine.signOut();
  await engine.signIn('a@example.com', 'secret1');
  await pgnCommentTranslationStore.ensureLoaded();
  assert.ok(pgnCommentTranslationStore.getRecord(anchor));
  await pgnTranslationQueue.ensureLoaded();
  assert.match(JSON.stringify(pgnTranslationQueue.getSnapshot()), /account-A-job/);
});

it('allows retry after abandonment without sharing the old result or clearing the new account', async () => {
  const hold = gate(),
    entered = gate();
  let abandoned = false;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (body.email === 'a@example.com') {
      entered.release();
      await hold.promise;
      return success('A');
    }
    return success('B');
  };
  const { auth, read } = authFixture();
  const engine = new CloudSyncEngine(new MemoryKeyValueStorage(), auth, new MemoryCloudRemote());
  const first = engine.signIn('a@example.com', 'secret1', { abandoned: () => abandoned });
  await entered.promise;
  abandoned = true;
  const second = await engine.signIn('b@example.com', 'secret2');
  assert.equal(second.ok, true);
  hold.release();
  assert.equal((await first).ok, false);
  assert.equal(engine.getState().user?.id, 'B');
  assert.equal(read()?.user.id, 'B');
});

it('cancels a scheduled retry when a manual synchronization has already completed', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const remote = new MemoryCloudRemote();
  const { engine, storage } = await connected(remote);
  let reads = 0;
  const list = remote.listDocuments.bind(remote);
  remote.listDocuments = async owner => { reads++; return list(owner); };
  await storage.setItem(StorageKeys.userProfile.key, '{"username":"Demo"}');
  engine.scheduleSync(50);
  await engine.sync();
  const confirmedReads = reads;
  assert.equal(engine.getState().status, 'synced');
  t.mock.timers.tick(1000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, confirmedReads);
});
