import assert from 'node:assert/strict';
import { it, afterEach } from 'node:test';
import { AsyncKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { CloudOperationError } from '../diagnostics.ts';
import {
  SYNCABLE_STORAGE_KEYS,
  cloudWorkspaceKey,
  CLOUD_ACTIVE_USER_KEY,
} from '../syncableKeys.ts';
import { readBackupIndex } from '../backupIndex.ts';
import { snapshotHash, SNAPSHOT_CHUNK_SIZE } from '../../storage/snapshotStorage.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
class LimitedRows {
  values = new Map<string, string>();
  limit = 6 * 1024 * 1024;
  writes = 0;
  refused = 0;
  failAfter = Infinity;
  size() {
    return [...this.values.values()].reduce((n, v) => n + Buffer.byteLength(v), 0);
  }
  async getItem(k: string) {
    const v = this.values.get(k) ?? null;
    if (v && Buffer.byteLength(v) > 2 * 1024 * 1024) throw new Error('CursorWindow');
    return v;
  }
  async setItem(k: string, v: string) {
    this.writes++;
    if (
      --this.failAfter === 0 ||
      this.size() - Buffer.byteLength(this.values.get(k) ?? '') + Buffer.byteLength(v) > this.limit
    ) {
      this.refused++;
      throw new Error('SQLITE_FULL PRIVATE');
    }
    this.values.set(k, v);
  }
  async removeItem(k: string) {
    this.values.delete(k);
  }
  async getAllKeys() {
    return [...this.values.keys()];
  }
}
const key = SYNCABLE_STORAGE_KEYS[0];
const study = (id: string, fill = 200000) =>
  JSON.stringify({
    version: 2,
    folders: [],
    files: [
      { id, filename: 'demo.pgn', folderId: 'unfiled', pgnText: `1. e4 {${'x'.repeat(fill)}} *` },
    ],
  });
const backupKeys = (r: LimitedRows) =>
  [...r.values.keys()].filter(
    (k) => /^anychess\.cloud\.backup\..+\.v1$/.test(k) && !k.endsWith('.index.v1'),
  );
async function phone(raw = new LimitedRows()) {
  setCloudTransferReadersForTests({ transport: async () => 'wifi' });
  const storage = new AsyncKeyValueStorage(raw),
    auth = new MemoryCloudAuth();
  auth.seed('demo@example.com', 'secret1', 'owner');
  let fail = false,
    reads = 0;
  const inner = new MemoryCloudRemote();
  await inner.upsertDocument('owner', {
    docKey: key,
    payload: study('remote'),
    revision: 1,
    updatedAt: '2026-01-01',
    deletedAt: null,
  });
  const remote = {
    async listDocuments(owner: string) {
      reads++;
      return inner.listDocuments(owner);
    },
    async upsertDocument(owner: string, doc: import('../types.ts').CloudDocument) {
      if (fail) throw new CloudOperationError('remote_service', 'remote.upsert', 'remote', 503);
      await inner.upsertDocument(owner, doc);
    },
  };
  const engine = new CloudSyncEngine(storage, auth, remote);
  await engine.signIn('demo@example.com', 'secret1');
  await storage.setItem(key, study('local'));
  return {
    raw,
    storage,
    auth,
    engine,
    fail: () => {
      fail = true;
    },
    reads: () => reads,
  };
}
afterEach(() => setCloudTransferReadersForTests({ transport: null }));
it('reuses one verified owner backup across repeated divergent failed syncs and preserves changed recovery copies', async () => {
  const p = await phone();
  p.fail();
  await p.engine.sync();
  const count = backupKeys(p.raw).length,
    bytes = p.raw.size();
  for (let i = 0; i < 4; i++) await p.engine.sync();
  assert.equal(backupKeys(p.raw).length, count);
  assert.equal(p.raw.size(), bytes);
  const first = await p.engine.backupLocal(false);
  await p.storage.setItem(key, study('new'));
  const next = await p.engine.backupLocal(false);
  assert.notEqual(next, first);
  assert.match((await p.storage.getItem(first))!, /local/);
  assert.match((await p.storage.getItem(next))!, /new/);
  await p.engine.signOut();
});
it('resumes identical incomplete blocks after restart without creating generations on every refused retry', async () => {
  const raw = new LimitedRows(),
    storage = new AsyncKeyValueStorage(raw),
    k = cloudWorkspaceKey('owner'),
    value = 'X'.repeat(300000);
  raw.limit = 120000;
  await assert.rejects(() => storage.setItem(k, value), /local_quota/);
  const first = [...raw.values.keys()].sort(),
    bytes = raw.size();
  for (let i = 0; i < 3; i++)
    await assert.rejects(() => new AsyncKeyValueStorage(raw).setItem(k, value), /local_quota/);
  assert.deepEqual([...raw.values.keys()].sort(), first);
  assert.equal(raw.size(), bytes);
  raw.limit = 6 * 1024 * 1024;
  const restarted = new AsyncKeyValueStorage(raw);
  await restarted.setItem(k, value);
  assert.equal(await restarted.getItem(k), value);
  const writes = raw.writes;
  await restarted.setItem(k, value);
  assert.equal(raw.writes, writes);
});
it('pauses timers, mutation and lifecycle requests after quota while keeping data and allowing an explicit retry', async () => {
  const p = await phone();
  p.fail();
  p.raw.limit = p.raw.size() + 10000;
  const before = await p.storage.getItem(key);
  await p.engine.sync();
  assert.equal(p.engine.getState().lastError, 'local_quota');
  const writes = p.raw.writes,
    reads = p.reads();
  p.engine.noteAvatarTransferFailure();
  p.engine.scheduleSync(1);
  p.engine.notifyLocalMutation(key);
  p.engine.markOffline();
  await p.engine.sync({ automatic: true });
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(p.raw.writes, writes);
  assert.equal(p.reads(), reads);
  assert.equal(await p.storage.getItem(key), before);
  p.raw.limit = 6 * 1024 * 1024;
  await p.engine.sync();
  assert.notEqual(p.engine.getState().lastError, 'local_quota');
  assert.ok(p.reads() > reads);
  await p.engine.signOut();
});
it('keeps account and guest data when logout cannot fit, then reuses a verified unchanged workspace without writes', async () => {
  const p = await phone();
  await p.engine.parkWorkspace('owner');
  const workspace = await p.storage.getItem(cloudWorkspaceKey('owner'));
  const writes = p.raw.writes;
  await p.engine.parkWorkspace('owner');
  assert.equal(p.raw.writes, writes);
  await p.storage.setItem(key, study('pending'));
  const guest = await p.storage.getItem(cloudWorkspaceKey('guest'));
  p.raw.limit = p.raw.size();
  assert.equal((await p.engine.signOut()).ok, false);
  assert.equal(p.engine.getState().user?.id, 'owner');
  assert.match((await p.storage.getItem(key))!, /pending/);
  assert.equal(await p.storage.getItem(cloudWorkspaceKey('owner')), workspace);
  assert.equal(await p.storage.getItem(cloudWorkspaceKey('guest')), guest);
  p.raw.limit = 6 * 1024 * 1024;
  assert.equal((await p.engine.signOut()).ok, true);
});
it('reuses an unindexed complete backup after an interrupted index write and isolates owners', async () => {
  const p = await phone(),
    first = await p.engine.backupLocal(false);
  await p.storage.removeItem('anychess.cloud.backup.index.v1');
  const count = backupKeys(p.raw).length;
  assert.equal(await p.engine.backupLocal(false), first);
  assert.equal(backupKeys(p.raw).length, count);
  assert.ok((await readBackupIndex(p.storage)).some((row) => row.key === first));
  await p.storage.setItem(CLOUD_ACTIVE_USER_KEY, 'other');
  const otherAuth = new MemoryCloudAuth(),
    other = new CloudSyncEngine(p.storage, otherAuth, {
      async listDocuments() {
        return [];
      },
      async upsertDocument() {},
    });
  const second = await other.backupLocal(false);
  assert.notEqual(second, first);
  assert.equal(JSON.parse((await p.storage.getItem(first))!).ownerId, 'owner');
  assert.equal(JSON.parse((await p.storage.getItem(second))!).ownerId, 'other');
  await p.engine.signOut();
});
it('reads a PR127 randomly named generation without rewriting or weakening its integrity checks', async () => {
  const raw = new LimitedRows(),
    storage = new AsyncKeyValueStorage(raw),
    root = cloudWorkspaceKey('legacy'),
    value = 'A'.repeat(140000),
    generation = 'old-random-127';
  const chunks = Array.from({ length: Math.ceil(value.length / SNAPSHOT_CHUNK_SIZE) }, (_, i) =>
    value.slice(i * SNAPSHOT_CHUNK_SIZE, (i + 1) * SNAPSHOT_CHUNK_SIZE),
  );
  for (let i = 0; i < chunks.length; i++)
    raw.values.set(`${root}.chunks.${generation}.${i}`, chunks[i]);
  raw.values.set(
    root,
    '@anychess/snapshot-chunks/1:' +
      JSON.stringify({
        generation,
        count: chunks.length,
        length: value.length,
        hash: snapshotHash(value),
      }),
  );
  assert.equal(await storage.getItem(root), value);
  await storage.setItem(root, value);
  assert.equal(raw.writes, 0);
  raw.values.delete(`${root}.chunks.${generation}.0`);
  await assert.rejects(() => storage.getItem(root), /local_storage/);
});

it('fits active copies, one verified backup and one workspace for all 18 large categories below 6 MiB', async () => {
  const p = await phone();
  for (const [k, i] of SYNCABLE_STORAGE_KEYS.map((k, i) => [k, i] as const))
    await p.storage.setItem(k, JSON.stringify({ category: i, data: 'x'.repeat(90000) }));
  const first = await p.engine.backupLocal(false);
  const writes = p.raw.writes;
  for (let i = 0; i < 3; i++) assert.equal(await p.engine.backupLocal(false), first);
  assert.equal(p.raw.writes, writes);
  await p.engine.parkWorkspace('owner');
  assert.ok(p.raw.size() < 6 * 1024 * 1024);
  assert.equal((await p.engine.signOut()).ok, true);
  const copy = JSON.parse((await p.storage.getItem(first))!);
  assert.equal(Object.keys(copy.docs).length, 18);
});

it('coalesces simultaneous identical backups without duplicate roots or index entries', async () => {
  const p = await phone();
  const results = await Promise.all(Array.from({ length: 4 }, () => p.engine.backupLocal(false)));
  assert.equal(new Set(results).size, 1);
  assert.equal(
    (await readBackupIndex(p.storage)).filter((row) => row.key === results[0]).length,
    1,
  );
  await p.engine.signOut();
});

it('does not trust a malformed same-owner backup even when all active categories are empty', async () => {
  const raw = new LimitedRows(),
    storage = new AsyncKeyValueStorage(raw),
    bad = 'anychess.cloud.backup.malformed.v1';
  await storage.setItem(
    bad,
    JSON.stringify({ ownerId: 'guest', docs: 'invalid recovery document' }),
  );
  const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), {
    async listDocuments() {
      return [];
    },
    async upsertDocument() {},
  });
  const good = await engine.backupLocal(false);
  assert.notEqual(good, bad);
  assert.equal(typeof JSON.parse((await storage.getItem(good))!).docs, 'object');
  assert.match((await storage.getItem(bad))!, /invalid recovery/);
});

it('stops a simulated old engine without logging out or touching its durable documents', async () => {
  const p = await phone(),
    before = await p.storage.getItem(key),
    reads = p.reads(),
    writes = p.raw.writes;
  p.engine.scheduleSync(1);
  p.engine.dispose();
  p.engine.notifyLocalMutation(key);
  await p.engine.sync({ automatic: true });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(p.reads(), reads);
  assert.equal(p.raw.writes, writes);
  assert.equal(await p.storage.getItem(key), before);
  assert.equal((await p.auth.getUser())?.id, 'owner');
});
