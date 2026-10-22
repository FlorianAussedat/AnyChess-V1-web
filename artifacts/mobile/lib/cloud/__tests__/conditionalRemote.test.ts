import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { SupabaseCloudAuth, SupabaseCloudRemote } from '../SupabaseCloud.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth } from '../MemoryCloud.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import type { CloudDocument, CloudSession } from '../types.ts';
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, originalKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-fixture';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = originalKey;
});
const document = (revision: number, payload = '{}'): CloudDocument => ({ docKey: 'demo', payload, revision, updatedAt: '2026-01-01', deletedAt: null });
const auth = { token: () => 'fixture-jwt', refreshSession: async () => false } as unknown as SupabaseCloudAuth;
it('uses insert-ignore for absent rows and a revision predicate for existing rows, rejecting stale writers', async () => {
  let revision = 0;
  globalThis.fetch = async (url, init) => {
    const data = JSON.parse(init!.body as string);
    if (init!.method === 'POST') {
      assert.match((init!.headers as Record<string,string>).Prefer, /ignore-duplicates/);
      if (revision) return Response.json([]);
    } else {
      assert.equal(init!.method, 'PATCH');
      const expected = Number(new URL(String(url)).searchParams.get('revision')!.slice(3));
      if (expected !== revision) return Response.json([]);
    }
    revision = data.revision;
    return Response.json([data]);
  };
  const remote = new SupabaseCloudRemote(auth);
  await remote.upsertDocument('owner', document(1));
  await assert.rejects(() => remote.upsertDocument('owner', document(1)), /sync_conflict/);
  await remote.upsertDocument('owner', document(2));
  await assert.rejects(() => remote.upsertDocument('owner', document(2)), /sync_conflict/);
  assert.equal(revision, 2);
});
it('runs two complete engines through the conditional HTTP adapter and converges without overwriting a peer', async () => {
  const rows = new Map<string, Record<string, unknown>>();
  let block = false, reads = 0, release!:()=>void;
  const both = new Promise<void>(resolve => { release = resolve; });
  let conflicts = 0;
  globalThis.fetch = async (url, init) => {
    if (init!.method === 'GET') {
      const snapshot = [...rows.values()].map(row => ({ ...row }));
      if (block && reads++ < 2) { if (reads === 2) release(); await both; }
      return Response.json(snapshot);
    }
    const data = JSON.parse(init!.body as string), previous = rows.get(data.doc_key);
    const expected = new URL(String(url)).searchParams.get('revision');
    if ((init!.method === 'POST' && previous) || (init!.method === 'PATCH' && previous?.revision !== Number(expected?.slice(3)))) {
      conflicts++; return Response.json([]);
    }
    rows.set(data.doc_key, data); return Response.json([data]);
  };
  const remote = new SupabaseCloudRemote(auth);
  async function phone() {
    const memoryAuth = new MemoryCloudAuth(); memoryAuth.seed('demo@example.com', 'secret1', 'owner');
    const storage = new MemoryKeyValueStorage(), engine = new CloudSyncEngine(storage, memoryAuth, remote);
    await engine.signIn('demo@example.com', 'secret1'); return { storage, engine };
  }
  const a = await phone(), b = await phone(), key = StorageKeys.repertoires.key;
  const doc = (id:string) => JSON.stringify({ version:2, folders:[], files:[{ id, folderId:'unfiled', filename:'demo.pgn', pgnText:`1. ${id === 'A' ? 'e4' : 'd4'} *` }] });
  await a.storage.setItem(key, doc('A')); await b.storage.setItem(key, doc('B'));
  block = true; await Promise.all([a.engine.sync(), b.engine.sync()]);
  assert.ok(conflicts > 0);
  assert.match((await a.storage.getItem(key))!, /A/); assert.match((await b.storage.getItem(key))!, /B/);
  await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
  assert.deepEqual(JSON.parse((await a.storage.getItem(key))!).files.map((f:{id:string})=>f.id).sort(), ['A','B']);
});
it('ignores a refresh response from a previous account after session replacement', async () => {
  let saved: CloudSession = { accessToken:'A-access', refreshToken:'A-refresh', user:{id:'A',email:'a@example.com'} };
  const sessionAuth = new SupabaseCloudAuth({ load: async()=>saved, save:async next=> { if (next) saved = next; } });
  await sessionAuth.hydrate();
  let release!:()=>void; const held = new Promise<void>(resolve=> { release=resolve; });
  globalThis.fetch = async()=> { await held; return Response.json({ access_token:'A-late', refresh_token:'A-new', user:{id:'A',email:'a@example.com'} }); };
  const refresh = sessionAuth.refreshSession();
  saved = { accessToken:'B-access', refreshToken:'B-refresh', user:{id:'B',email:'b@example.com'} };
  await sessionAuth.hydrate(); release();
  assert.equal(await refresh, false); assert.equal(sessionAuth.token(), 'B-access'); assert.equal(saved.user.id,'B');
});
