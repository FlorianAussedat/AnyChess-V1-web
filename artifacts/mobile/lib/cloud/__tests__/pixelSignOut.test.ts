import assert from 'node:assert/strict';
import { it } from 'node:test';
import { AsyncKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { SYNCABLE_STORAGE_KEYS, cloudWorkspaceKey } from '../syncableKeys.ts';
import { reportCloudError } from '../diagnostics.ts';
class AndroidRows {
  values = new Map<string, string>();
  fail = false;
  corrupt = false;
  async getItem(k: string) {
    const v = this.values.get(k) ?? null;
    if (v && Buffer.byteLength(v) > 2 * 1024 * 1024)
      throw new Error('Row too big to fit into CursorWindow PRIVATE');
    return this.corrupt && k.includes('.chunks.') && v ? v.slice(1) : v;
  }
  async setItem(k: string, v: string) {
    if (this.fail && k.includes('.chunks.')) throw new Error('database or disk is full PRIVATE');
    this.values.set(k, v);
  }
  async removeItem(k: string) {
    this.values.delete(k);
  }
  async getAllKeys() {
    return [...this.values.keys()];
  }
}
async function phone() {
  const raw = new AndroidRows(),
    storage = new AsyncKeyValueStorage(raw),
    auth = new MemoryCloudAuth();
  auth.seed('demo@example.com', 'secret1', 'owner');
  const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
  await engine.signIn('demo@example.com', 'secret1');
  const docs = Object.fromEntries(
    SYNCABLE_STORAGE_KEYS.map((k, i) => [
      k,
      JSON.stringify({ marker: `category-${i}`, data: 'x'.repeat(128 * 1024) }),
    ]),
  );
  for (const [k, v] of Object.entries(docs)) await storage.setItem(k, v);
  return { raw, storage, auth, engine, docs };
}
it('reproduces an oversized aggregate and preserves all 18 categories through logout and restart', async () => {
  const { raw, storage, engine, docs } = await phone(),
    key = cloudWorkspaceKey('owner');
  raw.values.set(key, JSON.stringify({ ownerId: 'owner', origin: 'account', docs }));
  await assert.rejects(() => raw.getItem(key), /CursorWindow/);
  assert.deepEqual(await engine.signOut(), { ok: true });
  assert.equal(engine.getState().user, null);
  const restarted = new AsyncKeyValueStorage(raw);
  assert.deepEqual(JSON.parse((await restarted.getItem(key))!).docs, docs);
  const restore = new CloudSyncEngine(restarted, new MemoryCloudAuth(), new MemoryCloudRemote());
  await restore.restoreWorkspace('owner');
  for (const k of SYNCABLE_STORAGE_KEYS) assert.equal(await restarted.getItem(k), docs[k]);
  assert.ok(await storage.getItem(cloudWorkspaceKey('guest')));
});
it('blocks logout on quota failure with the old snapshot, live data and session intact; retry succeeds', async () => {
  const { raw, storage, auth, engine, docs } = await phone(),
    key = cloudWorkspaceKey('owner');
  await engine.parkWorkspace('owner');
  const previous = await storage.getItem(key);
  docs[SYNCABLE_STORAGE_KEYS[0]] = JSON.stringify({ pending: 'new change', data: 'x'.repeat(128*1024) });
  await storage.setItem(SYNCABLE_STORAGE_KEYS[0],docs[SYNCABLE_STORAGE_KEYS[0]]);
  raw.fail = true;
  assert.equal((await engine.signOut()).ok, false);
  assert.equal(engine.getState().lastError, 'local_quota');
  assert.equal(engine.getState().user?.id, 'owner');
  assert.equal((await auth.getUser())?.id, 'owner');
  assert.equal(await storage.getItem(key), previous);
  for (const k of SYNCABLE_STORAGE_KEYS) assert.equal(await storage.getItem(k), docs[k]);
  raw.fail = false;
  assert.equal((await engine.signOut()).ok, true);
});
it('refuses corrupt new chunks without committing a replacement or clearing active documents', async () => {
  const { raw, storage, engine, docs } = await phone(),
    key = cloudWorkspaceKey('owner'),
    previous = await storage.getItem(key);
  raw.corrupt = true;
  assert.equal((await engine.signOut()).ok, false);
  assert.equal(engine.getState().user?.id, 'owner');
  raw.corrupt = false;
  assert.equal(await storage.getItem(key), previous);
  for (const k of SYNCABLE_STORAGE_KEYS) assert.equal(await storage.getItem(k), docs[k]);
});
it('reads legacy snapshots and preserves Unicode, other accounts and backups during replacement/removal', async () => {
  const raw = new AndroidRows(),
    storage = new AsyncKeyValueStorage(raw),
    a = cloudWorkspaceKey('A'),
    b = cloudWorkspaceKey('B'),
    backup = 'anychess.cloud.backup.demo.v1';
  raw.values.set(a, '{"legacy":true}');
  assert.equal(await storage.getItem(a), '{"legacy":true}');
  const value = '🧩'.repeat(100000) + 'END';
  await Promise.all([storage.setItem(a, value), storage.setItem(b, value + 'B')]);
  await storage.setItem(backup, value + 'backup');
  await storage.setItem(a, value + 'new');
  assert.equal(await storage.getItem(a), value + 'new');
  await storage.removeItem(a);
  assert.equal(await storage.getItem(a), null);
  assert.equal(await storage.getItem(b), value + 'B');
  assert.equal(await storage.getItem(backup), value + 'backup');
  assert.equal([...raw.values.keys()].filter((k) => k.startsWith(a + '.chunks.')).length, 0);
});
it('blocks logout when an active document is unreadable and redacts private error content', async () => {
  const { raw, engine } = await phone();
  raw.values.set(SYNCABLE_STORAGE_KEYS[0], 'x'.repeat(3 * 1024 * 1024));
  assert.equal((await engine.signOut()).ok, false);
  assert.equal(engine.getState().lastError, 'local_size_limit');
  assert.equal(engine.getState().user?.id, 'owner');
  assert.ok(raw.values.get(SYNCABLE_STORAGE_KEYS[0]));
  const warn = console.warn,
    previous = (globalThis as any).__DEV__,
    messages: unknown[] = [];
  (globalThis as any).__DEV__ = true;
  console.warn = (...v: unknown[]) => {
    messages.push(v);
  };
  try {
    reportCloudError(
      'workspace.verify',
      'local',
      new Error('CursorWindow PRIVATE token=email PGN'),
    );
  } finally {
    console.warn = warn;
    (globalThis as any).__DEV__ = previous;
  }
  assert.match(JSON.stringify(messages), /local_size_limit/);
  assert.doesNotMatch(JSON.stringify(messages), /PRIVATE|token=|email|PGN/);
});

it('keeps the committed snapshot after a partial write or interrupted manifest publication', async () => {
  class Interrupted extends AndroidRows {
    remaining = Infinity;
    failCommit = false;
    override async setItem(key: string, value: string) {
      if (key.includes('.chunks.') && --this.remaining === 0)
        throw new Error('interrupted local write PRIVATE');
      if (this.failCommit && key === cloudWorkspaceKey('owner'))
        throw new Error('database or disk is full');
      return super.setItem(key, value);
    }
  }
  const raw = new Interrupted(),
    storage = new AsyncKeyValueStorage(raw),
    key = cloudWorkspaceKey('owner');
  const previous = 'A'.repeat(200000);
  await storage.setItem(key, previous);
  raw.remaining = 2;
  await assert.rejects(() => storage.setItem(key, 'B'.repeat(300000)), /local_storage/);
  assert.equal(await new AsyncKeyValueStorage(raw).getItem(key), previous);
  raw.remaining = Infinity;
  raw.failCommit = true;
  await assert.rejects(() => storage.setItem(key, 'C'.repeat(300000)), /local_quota/);
  assert.equal(await storage.getItem(key), previous);
  raw.failCommit = false;
  await storage.removeItem(key);
  assert.equal([...raw.values.keys()].filter((k) => k.startsWith(key + '.chunks.')).length, 0);
});

it('serializes snapshot reads/replacements across adapters sharing the same backend', async () => {
  const raw = new AndroidRows(),
    a = new AsyncKeyValueStorage(raw),
    b = new AsyncKeyValueStorage(raw),
    key = cloudWorkspaceKey('owner');
  const first = 'A'.repeat(200000),
    second = 'B'.repeat(200000);
  await a.setItem(key, first);
  const reads = await Promise.all([a.getItem(key), b.setItem(key, second), a.getItem(key)]);
  assert.equal(reads[0], first);
  assert.equal(reads[2], second);
  assert.equal(await b.getItem(key), second);
});

it('refuses to finish logout when an active document changes while its snapshot is written', async () => {
  const { raw, storage, engine } = await phone(),
    key = SYNCABLE_STORAGE_KEYS[0];
  const write = raw.setItem.bind(raw);
  let changed = false;
  raw.setItem = async (k, v) => {
    await write(k, v);
    if (!changed && k.includes('.chunks.')) {
      changed = true;
      await storage.setItem(key, '{"pending":"new edit"}');
      engine.notifyLocalMutation(key);
    }
  };
  assert.equal((await engine.signOut()).ok, false);
  assert.equal(engine.getState().user?.id, 'owner');
  assert.equal(await storage.getItem(key), '{"pending":"new edit"}');
  raw.setItem = write;
  assert.equal((await engine.signOut()).ok, true);
  assert.equal(
    JSON.parse((await storage.getItem(cloudWorkspaceKey('owner')))!).docs[key],
    '{"pending":"new edit"}',
  );
});

it('parks only once and signs out within a simulated 6 MiB Android database', async () => {
  const {raw,storage,engine,docs}=await phone();
  const write=raw.setItem.bind(raw);let ownerCommits=0;
  raw.setItem=async(key,value)=>{
    const size=[...raw.values].reduce((sum,[k,v])=>sum+(k===key?0:Buffer.byteLength(v)),0)+Buffer.byteLength(value);
    if(size>6*1024*1024)throw new Error('SQLITE_FULL');
    if(key===cloudWorkspaceKey('owner'))ownerCommits++;
    await write(key,value);
  };
  assert.equal((await engine.signOut()).ok,true);assert.equal(ownerCommits,1);
  assert.deepEqual(JSON.parse((await storage.getItem(cloudWorkspaceKey('owner')))!).docs,docs);
});

it('never clears a late edit when auth cleanup completed but its follow-up parking hits quota', async () => {
  const {raw,storage,auth,engine}=await phone(),key=SYNCABLE_STORAGE_KEYS[0];
  const logout=auth.signOut.bind(auth);
  auth.signOut=async()=>{
    await storage.setItem(key,'{"pending":"late edit during auth cleanup"}');
    engine.notifyLocalMutation(key);raw.fail=true;await logout();
  };
  assert.equal((await engine.signOut()).ok,false);
  assert.equal(await storage.getItem(key),'{"pending":"late edit during auth cleanup"}');
  assert.equal(engine.getState().lastError,'local_quota');
  assert.equal(engine.getState().sessionReady,false);
  assert.equal(engine.getState().status,'error');
});
