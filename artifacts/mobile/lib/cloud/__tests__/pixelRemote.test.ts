import assert from 'node:assert/strict';
import { afterEach, beforeEach, it } from 'node:test';
import { SupabaseCloudAuth, SupabaseCloudRemote } from '../SupabaseCloud.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { CloudOperationError } from '../diagnostics.ts';
import { MemoryCloudAuth } from '../MemoryCloud.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { SYNCABLE_STORAGE_KEYS } from '../syncableKeys.ts';
const originalFetch = globalThis.fetch,
  oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL,
  oldKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
beforeEach(() => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-fixture';
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
  if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = oldKey;
});
const auth = {
  token: () => 'fixture-jwt',
  refreshSession: async () => false,
} as unknown as SupabaseCloudAuth;
const doc = {
  docKey: SYNCABLE_STORAGE_KEYS[0],
  payload: '{}',
  revision: 2,
  updatedAt: '2026-01-01',
  deletedAt: null,
};
for (const code of ['42703', 'PGRST204'])
  it(`distinguishes missing revision on GET and conditional PATCH (${code}) without unsafe legacy upsert`, async () => {
    const methods: string[] = [];
    globalThis.fetch = async (_url, init) => {
      methods.push(init!.method!);
      return Response.json(
        { code, message: 'column user_documents.revision does not exist PRIVATE' },
        { status: 400 },
      );
    };
    const remote = new SupabaseCloudRemote(auth);
    for (const action of [
      () => remote.listDocuments('owner'),
      () => remote.upsertDocument('owner', doc),
    ])
      await assert.rejects(
        action,
        (error: any) =>
          error instanceof CloudOperationError &&
          error.kind === 'schema_revision_missing' &&
          error.httpStatus === 400 &&
          !error.message.includes('PRIVATE'),
      );
    assert.deepEqual(methods, ['GET', 'PATCH']);
  });
for (const [status, code, kind] of [
  [404, 'PGRST205', 'schema_missing'],
  [401, '', 'session_expired'],
  [403, '42501', 'remote_permission'],
  [409, '23505', 'sync_conflict'],
  [503, '', 'remote_service'],
] as const)
  it(`classifies HTTP ${status} without leaking response body`, async () => {
    globalThis.fetch = async () =>
      Response.json({ code, message: 'PRIVATE PGN token=secret' }, { status });
    await assert.rejects(
      () => new SupabaseCloudRemote(auth).listDocuments('owner'),
      (error: any) => error.kind === kind && !JSON.stringify(error).includes('PRIVATE'),
    );
  });
it('rejects an empty conditional update and malformed successful responses instead of declaring success', async () => {
  const remote = new SupabaseCloudRemote(auth);
  globalThis.fetch = async () => Response.json([]);
  await assert.rejects(() => remote.upsertDocument('owner', doc), /sync_conflict/);
  globalThis.fetch = async () => new Response('PRIVATE invalid json', { status: 200 });
  await assert.rejects(() => remote.listDocuments('owner'), /remote_service/);
  await assert.rejects(() => remote.upsertDocument('owner', doc), /remote_service/);
  globalThis.fetch = async () =>
    Response.json([{ doc_key: doc.docKey, payload: {}, revision: null }]);
  await assert.rejects(() => remote.listDocuments('owner'), /remote_service/);
});
it('retains local modifications and a connected session when the actual REST adapter finds an old schema', async () => {
  const storage = new MemoryKeyValueStorage(),
    memoryAuth = new MemoryCloudAuth();
  memoryAuth.seed('demo@example.com', 'secret1', 'owner');
  globalThis.fetch = async () =>
    Response.json(
      { code: '42703', message: 'column user_documents.revision does not exist' },
      { status: 400 },
    );
  const engine = new CloudSyncEngine(storage, memoryAuth, new SupabaseCloudRemote(auth));
  await engine.signIn('demo@example.com', 'secret1');
  await storage.setItem(
    SYNCABLE_STORAGE_KEYS[0],
    JSON.stringify({ version: 2, folders: [], files: [{ id: 'pending', pgnText: '1. e4 *' }] }),
  );
  const before = await storage.getItem(SYNCABLE_STORAGE_KEYS[0]);
  await engine.sync();
  assert.equal(engine.getState().status, 'error');
  assert.equal(engine.getState().lastError, 'schema_revision_missing');
  assert.equal(engine.getState().user?.id, 'owner');
  assert.equal(await storage.getItem(SYNCABLE_STORAGE_KEYS[0]), before);
  assert.equal((await engine.signOut()).ok, true);
});
it('reports failed local backup as local storage rather than a Supabase error and keeps data', async () => {
  class FailingBackup extends MemoryKeyValueStorage {
    fail = false;
    override async setItem(k: string, v: string) {
      if (this.fail && k.includes('.backup.')) throw new Error('SQLITE_FULL');
      await super.setItem(k, v);
    }
  }
  const storage = new FailingBackup(),
    memoryAuth = new MemoryCloudAuth();
  memoryAuth.seed('demo@example.com', 'secret1', 'owner');
  globalThis.fetch = async () =>
    Response.json([
      {
        doc_key: SYNCABLE_STORAGE_KEYS[0],
        payload: { version: 2, folders: [], files: [{ id: 'remote', pgnText: '1. d4 *' }] },
        revision: 1,
        updated_at: '2026-01-01',
        deleted_at: null,
      },
    ]);
  const engine = new CloudSyncEngine(storage, memoryAuth, new SupabaseCloudRemote(auth));
  await engine.signIn('demo@example.com', 'secret1');
  const value = JSON.stringify({
    version: 2,
    folders: [],
    files: [{ id: 'local', pgnText: '1. e4 *' }],
  });
  await storage.setItem(SYNCABLE_STORAGE_KEYS[0], value);
  storage.fail = true;
  await engine.sync();
  assert.equal(engine.getState().lastError, 'local_quota');
  assert.equal(engine.getState().status, 'error');
  assert.equal(await storage.getItem(SYNCABLE_STORAGE_KEYS[0]), value);
  await engine.signOut();
});
