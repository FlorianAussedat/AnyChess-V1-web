/**
 * An Edge Function failure is not a missing client configuration.
 * Auth keeps a saved session, and a failed translation is not stored as done.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { PgnCommentTranslationStore } from '../../pgnComments/PgnCommentTranslationStore.ts';
import { PgnTranslationQueue } from '../../pgnComments/PgnTranslationQueue.ts';
import { setUserAccessTokenForTests, translateViaProxy } from '../../pgnComments/liveProvider.ts';
import { SupabaseCloudAuth } from '../SupabaseCloud.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudRemote } from '../MemoryCloud.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
import { CLOUD_SESSION_KEY } from '../syncableKeys.ts';

const URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';
const ANON = 'public-anon-test';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('edge function outage', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = URL;
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = ANON;
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
  });

  it('signs in through Auth while the translate function is unavailable', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new SupabaseCloudAuth({
      async load() {
        const raw = await storage.getItem(CLOUD_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      },
      async save(session) {
        if (!session) await storage.removeItem(CLOUD_SESSION_KEY);
        else await storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
      },
    });
    const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const target = String(input);
      if (target.includes('/auth/v1/token')) {
        return jsonResponse(200, {
          access_token: 'user-access',
          refresh_token: 'user-refresh',
          user: { id: 'user-1', email: 'ada@example.com' },
        });
      }
      if (target.includes('/functions/v1/')) return jsonResponse(503, { error: 'unavailable' });
      return jsonResponse(503, {});
    }) as typeof fetch;
    try {
      const signed = await engine.signIn('ada@example.com', 'secret-secret');
      assert.equal(signed.ok, true);
      assert.equal(engine.getState().status === 'unconfigured', false);
      assert.equal(engine.getState().user?.email, 'ada@example.com');
      const raw = await storage.getItem(CLOUD_SESSION_KEY);
      assert.match(raw ?? '', /user-access/);
      const again = new SupabaseCloudAuth({
        async load() {
          const saved = await storage.getItem(CLOUD_SESSION_KEY);
          return saved ? JSON.parse(saved) : null;
        },
        async save() {},
      });
      const restored = await again.hydrate();
      assert.equal(restored?.id, 'user-1');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('keeps the original comment queued when the function answers 503', async () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    queue.setPolicy({ catchup: true, import: true });
    const pgn = `[Event "Err"]\n\n1. e4 {White occupies the center.} *`;
    await queue.enqueuePgn(pgn, 'repertoire', 'err', 'catchup');
    const before = store.getSnapshot();
    queue.setProvider({
      configured: true,
      async translateComments(batch) {
        return batch.map((item) => ({ id: item.id, error: 'offline' as const }));
      },
    });
    const result = await queue.processNext(1);
    assert.equal(result.blocked, 'offline');
    assert.equal(result.done, 0);
    const job = Object.values(queue.getSnapshot().jobs)[0]!;
    assert.equal(job.status, 'queued');
    assert.equal(job.original, 'White occupies the center.');
    assert.deepEqual(store.getSnapshot().records, before.records);
    assert.equal(queue.getLastError(), 'offline');
  });

  it('does not treat a function 503 or 401 as a successful translation', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new SupabaseCloudAuth({
      async load() {
        const raw = await storage.getItem(CLOUD_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
      },
      async save(session) {
        if (!session) await storage.removeItem(CLOUD_SESSION_KEY);
        else await storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
      },
    });
    const original = globalThis.fetch;
    const seenAuth = new Set<string>();
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = String(input);
      const authorization = new Headers(init?.headers).get('authorization') ?? '';
      if (authorization.startsWith('Bearer ')) seenAuth.add('bearer');
      if (target.includes('/auth/v1/token')) {
        return jsonResponse(200, {
          access_token: 'user-access',
          refresh_token: 'user-refresh',
          user: { id: 'user-2', email: 'ada@example.com' },
        });
      }
      if (target.includes('/functions/v1/')) return jsonResponse(503, { message: 'unavailable' });
      return jsonResponse(401, { code: 'UNAUTHORIZED' });
    }) as typeof fetch;
    try {
      const signed = await auth.signIn('ada@example.com', 'secret-secret');
      assert.equal(signed.ok, true);
      assert.equal(auth.configured, true);
      setUserAccessTokenForTests('user-access');
      const down = await translateViaProxy(`${URL}/functions/v1/pgn-translate`, [
        { id: 'c1', text: 'White occupies the center.' },
      ]);
      assert.equal(down[0]?.text, undefined);
      assert.equal(down[0]?.error, 'offline');
      assert.equal(seenAuth.has('bearer'), true);
      globalThis.fetch = (async (input: RequestInfo | URL) => {
        const target = String(input);
        if (target.includes('/functions/v1/')) return jsonResponse(401, { code: 'UNAUTHORIZED' });
        return jsonResponse(401, {});
      }) as typeof fetch;
      const rejected = await translateViaProxy(`${URL}/functions/v1/pgn-translate`, [
        { id: 'c1', text: 'White occupies the center.' },
      ]);
      assert.equal(rejected[0]?.text, undefined);
      assert.equal(rejected[0]?.error, 'offline');
      assert.equal(auth.configured, true);
      const restored = await auth.hydrate();
      assert.equal(restored?.id, 'user-2');
    } finally {
      setUserAccessTokenForTests(undefined);
      globalThis.fetch = original;
    }
  });
});
