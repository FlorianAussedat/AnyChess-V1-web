import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { translate } from '../../i18n/messages.ts';
import { PreferencesStore } from '../../preferences/PreferencesStore.ts';
import { loadStoredJson } from '../../storage/safeParse.ts';
import { CloudSyncEngine, restoreBackup } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import type { CloudDocument, CloudRemote } from '../types.ts';
import { CLOUD_ACTIVE_USER_KEY, SYNCABLE_STORAGE_KEYS, cloudWorkspaceKey } from '../syncableKeys.ts';
import { readBackupIndex } from '../backupIndex.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
import { mergeDocumentPayload } from '../mergeDocuments.ts';
import { clearPendingAvatar, readPendingAvatar, savePendingAvatar } from '../../profile/avatarLocal.ts';
import { flushPendingAvatar } from '../../profile/avatarRemote.ts';

const engines = new Set<CloudSyncEngine>();
function tracked(engine:CloudSyncEngine):CloudSyncEngine { engines.add(engine);return engine; }
const key = StorageKeys.repertoires.key;
const pgn = (id: string, text = '1. e4 {demo} (1. d4 d5) e5 $1 *') => ({ id, filename: 'same.pgn', pgnText: text, folderId: 'nested', importedAt: '2026-01-01' });
const doc = (...files: ReturnType<typeof pgn>[]) => JSON.stringify({ version: 2, folders: [{ id: 'root', name: 'Root', parentId: null }, { id: 'nested', name: 'Nested', parentId: 'root' }], files });
const read = async (storage: MemoryKeyValueStorage) => JSON.parse((await storage.getItem(key)) ?? '{"files":[]}');
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function device(remote: CloudRemote, storage = new MemoryKeyValueStorage()) {
  const auth = new MemoryCloudAuth();
  auth.seed('demo@example.com', 'secret1', 'shared-owner');
  const engine = tracked(new CloudSyncEngine(storage, auth, remote));
  await engine.signIn('demo@example.com', 'secret1');
  return { engine, storage, auth };
}
afterEach(() => { for(const engine of engines)engine.dispose();engines.clear();setCloudTransferReadersForTests({ transport: null }); });

describe('two devices and a shared remote', () => {
  it('preserves distinct same-name/same-content IDs, nested folders and round-trip PGN without duplicates', async () => {
    const remote = new MemoryCloudRemote();
    const a = await device(remote), b = await device(remote);
    await a.storage.setItem(key, doc(pgn('A')));
    await b.storage.setItem(key, doc(pgn('B')));
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    for (const d of [a, b]) {
      assert.deepEqual((await read(d.storage)).files.map((f: {id:string}) => f.id).sort(), ['A', 'B']);
      assert.equal((await read(d.storage)).folders.find((f: {id:string}) => f.id === 'nested').parentId, 'root');
    }
    const before = await a.storage.getItem(key);
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    assert.equal(await a.storage.getItem(key), before);
    assert.match(before!, /demo/); assert.match(before!, /\$1/);
  });
  it('keeps conflicting variants/comments under stable recovery IDs on both devices', async () => {
    const remote = new MemoryCloudRemote();
    const a = await device(remote), b = await device(remote);
    await a.storage.setItem(key, doc(pgn('study', '1. e4 {A} (1. c4) *')));
    await b.storage.setItem(key, doc(pgn('study', '1. d4 {B} (1. Nf3) *')));
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    const result = await read(a.storage);
    assert.equal(result.files.length, 2);
    assert.match(JSON.stringify(result), /\{A\}/); assert.match(JSON.stringify(result), /\{B\}/);
    assert.ok(result.files.some((f: {id:string}) => f.id.startsWith('study~recovery-')));
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    assert.equal((await read(a.storage)).files.length, 2);
  });
  it('does not resurrect an offline deletion from another device old copy', async () => {
    const remote = new MemoryCloudRemote();
    const a = await device(remote);
    await a.storage.setItem(key, doc(pgn('gone'), pgn('keep'))); await a.engine.sync();
    const b = await device(remote);
    await a.storage.setItem(key, JSON.stringify({ ...JSON.parse(doc(pgn('keep'))), syncDeletedIds: ['gone'] }));
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    assert.deepEqual((await read(b.storage)).files.map((f:{id:string}) => f.id), ['keep']);
  });
  it('resumes durable offline changes after engine restart on cellular with legacy Wi-Fi restriction', async () => {
    const remote = new MemoryCloudRemote(), a = await device(remote);
    setCloudTransferReadersForTests({ transport: async () => 'offline' });
    await a.storage.setItem(key, doc(pgn('offline')));
    await a.storage.setItem(StorageKeys.userPreferences.key, JSON.stringify({ language: 'en', syncOnWifiOnly: true }));
    await a.engine.sync(); assert.equal(a.engine.getState().status, 'offline');
    a.engine.dispose();
    const restarted = tracked(new CloudSyncEngine(a.storage, a.auth, remote));
    await restarted.hydrate(); assert.equal(restarted.getState().user?.id, 'shared-owner');
    assert.match((await a.storage.getItem(key))!, /offline/);
    setCloudTransferReadersForTests({ transport: async () => 'cellular' });
    await restarted.sync(); assert.equal(restarted.getState().status, 'synced');
    assert.match(remote.peek('shared-owner', key)!.payload!, /offline/);
  });
  it('keeps profile, canonical language, independent scores, and puzzle attempts across devices', async () => {
    const remote = new MemoryCloudRemote(), a = await device(remote), b = await device(remote);
    await a.storage.setItem(StorageKeys.userProfile.key, JSON.stringify({ username: 'Demo', mascotId: 'knight', updatedAt: '2026-02-01' }));
    await a.storage.setItem(StorageKeys.userPreferences.key, JSON.stringify({ language: 'en', chessNotation: 'en', updatedAt: '2026-02-01' }));
    await a.storage.setItem(StorageKeys.moveNamingSession60.key, JSON.stringify({ best: 12 }));
    await b.storage.setItem(StorageKeys.moveNamingSession60.key, JSON.stringify({ best: 20 }));
    await a.storage.setItem(StorageKeys.puzzleHistory.key, JSON.stringify([{ puzzleId: 'A', playedAt: '2026-02-01' }]));
    await b.storage.setItem(StorageKeys.puzzleHistory.key, JSON.stringify([{ puzzleId: 'B', playedAt: '2026-02-02' }]));
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    assert.equal(JSON.parse((await b.storage.getItem(StorageKeys.userProfile.key))!).username, 'Demo');
    assert.equal(JSON.parse((await b.storage.getItem(StorageKeys.userPreferences.key))!).language, 'en');
    assert.equal(JSON.parse((await a.storage.getItem(StorageKeys.moveNamingSession60.key))!).best, 20);
    assert.deepEqual(JSON.parse((await a.storage.getItem(StorageKeys.puzzleHistory.key))!).map((v:{puzzleId:string}) => v.puzzleId), ['B','A']);
  });
  it('keeps account documents when an explicit guest import meets newer remote documents', async () => {
    const remote = new MemoryCloudRemote(), a = await device(remote);
    await a.storage.setItem(cloudWorkspaceKey('guest'), JSON.stringify({ ownerId: 'guest', origin: 'guest', docs: { [key]: doc(pgn('guest-study')) } }));
    await remote.upsertDocument('shared-owner', { docKey: key, payload: doc(pgn('remote-study')), revision: 1, updatedAt: '2026-01-01', deletedAt: null });
    assert.equal((await a.engine.importGuestData()).ok, true);
    assert.match(remote.peek('shared-owner', key)!.payload!, /remote-study/);
    assert.match(remote.peek('shared-owner', key)!.payload!, /guest-study/);
  });
  it('keeps recovery and live content when local commit fails after an acknowledged upload', async () => {
    class FaultStorage extends MemoryKeyValueStorage {
      fail = false;
      override async updateItem(k:string, update:(current:string|null)=>string|null, source?:'cloud') {
        if (this.fail && k === key && source === 'cloud') throw new Error('disk full');
        return super.updateItem(k, update);
      }
    }
    const storage = new FaultStorage(), remote = new MemoryCloudRemote(), a = await device(remote, storage);
    await storage.setItem(key, doc(pgn('local')));
    await remote.upsertDocument('shared-owner', { docKey: key, payload: doc(pgn('remote')), revision: 1, updatedAt: '2026-01-01', deletedAt: null });
    storage.fail = true; await a.engine.sync(); assert.equal(a.engine.getState().status, 'error');
    assert.match((await storage.getItem(key))!, /local/);
    assert.match(remote.peek('shared-owner', key)!.payload!, /remote/);
    storage.fail = false; await a.engine.sync(); assert.match((await storage.getItem(key))!, /remote/);
    assert.equal(a.engine.getState().status, 'synced');
  });
  it('converges after concurrent devices read the same old revision', async () => {
    const inner = new MemoryCloudRemote(); let blocked = false, reads = 0;
    const both = gate();
    const remote: CloudRemote = {
      async listDocuments(owner) {
        const snapshot = await inner.listDocuments(owner);
        if (blocked && reads++ < 2) { if (reads === 2) both.release(); await both.promise; }
        return snapshot;
      },
      upsertDocument: (owner, d) => inner.upsertDocument(owner, d),
    };
    const a = await device(remote), b = await device(remote);
    await a.storage.setItem(key, doc(pgn('A'))); await b.storage.setItem(key, doc(pgn('B')));
    blocked = true;
    await Promise.all([a.engine.sync(), b.engine.sync()]);
    await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
    assert.deepEqual((await read(a.storage)).files.map((f:{id:string}) => f.id).sort(), ['A','B']);
  });
});

describe('single-flight, interruptions and local durability', () => {
  it('coalesces manual/automatic/network sync requests even while transport detection waits', async () => {
    const inner = new MemoryCloudRemote(), a = await device(inner);
    await a.storage.setItem(key, doc(pgn('one')));
    const hold = gate(); let probes = 0, active = 0, maximum = 0;
    setCloudTransferReadersForTests({ transport: async () => { probes++; active++; maximum = Math.max(maximum, active); await hold.promise; active--; return 'wifi'; } });
    const requests = [a.engine.sync(), a.engine.sync(), a.engine.sync()];
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(probes, 1); hold.release(); await Promise.all(requests); assert.equal(maximum, 1);
    assert.equal(a.engine.getState().status, 'synced');
  });
  it('preserves local mutation while upload is blocked and follows up', async () => {
    const inner = new MemoryCloudRemote(), entered = gate(), resume = gate(); let block = false;
    const remote: CloudRemote = {
      listDocuments: o => inner.listDocuments(o),
      async upsertDocument(o,d) { if (block && d.docKey === key) { block = false; entered.release(); await resume.promise; } await inner.upsertDocument(o,d); },
    };
    const a = await device(remote); await a.storage.setItem(key, doc(pgn('old')));
    block = true; const syncing = a.engine.sync(); await entered.promise;
    await a.storage.setItem(key, doc(pgn('old'), pgn('during'))); a.engine.notifyLocalMutation();
    resume.release(); await syncing; await a.engine.sync();
    assert.match((await a.storage.getItem(key))!, /during/);
    assert.match(inner.peek('shared-owner', key)!.payload!, /during/);
  });
  it('does not claim success for a partial HTTP success and retains local edits', async () => {
    const inner = new MemoryCloudRemote(); let discard = false;
    const remote: CloudRemote = { listDocuments: o => inner.listDocuments(o), upsertDocument: async(o,d) => { if (!discard) await inner.upsertDocument(o,d); } };
    const a = await device(remote); await a.storage.setItem(key, doc(pgn('pending')));
    discard = true; await a.engine.sync();
    assert.equal(a.engine.getState().status, 'pending'); assert.match((await a.storage.getItem(key))!, /pending/);
    discard = false; await a.engine.sync(); assert.equal(a.engine.getState().status, 'synced');
  });
  it('survives a transfer error and a new engine without replacing its durable document', async () => {
    const inner = new MemoryCloudRemote(); let fail = false;
    const remote: CloudRemote = { listDocuments: o => inner.listDocuments(o), async upsertDocument(o,d) { if (fail) throw new Error('network interrupted token=DO_NOT_SHOW'); await inner.upsertDocument(o,d); } };
    const a = await device(remote); const original = doc(pgn('safe')); await a.storage.setItem(key, original);
    fail = true; await a.engine.sync(); assert.equal(await a.storage.getItem(key), original);
    assert.equal(a.engine.getState().lastError, 'sync_failed'); assert.equal(a.engine.getState().status, 'offline');
    a.engine.dispose();
    const restarted = tracked(new CloudSyncEngine(a.storage, a.auth, remote)); await restarted.hydrate();
    fail = false; await restarted.sync(); assert.match(inner.peek('shared-owner', key)!.payload!, /safe/);
  });
  it('retains a visible failed local save until a later durable local mutation', async () => {
    const a = await device(new MemoryCloudRemote()); a.engine.noteLocalSaveFailure();
    await a.engine.sync(); assert.equal(a.engine.getState().lastError, 'local_save_failed');
    await a.storage.setItem(key, doc(pgn('retry'))); a.engine.notifyLocalMutation();
    await a.engine.sync(); assert.equal(a.engine.getState().status, 'synced');
  });
  it('does not clear a failed document save when an unrelated key succeeds', async () => {
    const a = await device(new MemoryCloudRemote());
    a.engine.noteLocalSaveFailure(key);
    a.engine.notifyLocalMutation(StorageKeys.userProfile.key);
    await a.engine.sync(); assert.equal(a.engine.getState().lastError, 'local_save_failed');
    await a.storage.setItem(key, doc(pgn('retried'))); a.engine.notifyLocalMutation(key);
    await a.engine.sync(); assert.equal(a.engine.getState().status,'synced');
  });
  it('aborts before remote upload on a storage read error', async () => {
    class FailingStorage extends MemoryKeyValueStorage {
      fail = false;
      override async getItem(k: string) { if (this.fail && k === key) throw new Error('disk unreadable'); return super.getItem(k); }
    }
    const storage = new FailingStorage(), remote = new MemoryCloudRemote(); const a = await device(remote, storage);
    await storage.setItem(key, doc(pgn('safe'))); storage.fail = true;
    await a.engine.sync(); assert.equal(a.engine.getState().status, 'error');
    assert.equal(remote.peek('shared-owner', key), undefined);
    storage.fail = false; assert.match((await storage.getItem(key))!, /safe/);
  });
  it('never publishes a preference update or reset before successful persistence', async () => {
    class FaultStorage extends MemoryKeyValueStorage {
      fail = false;
      override async setItem(k:string,v:string) { if (this.fail && k === StorageKeys.userPreferences.key) throw new Error('disk full'); return super.setItem(k,v); }
    }
    const storage = new FaultStorage(), prefs = new PreferencesStore(storage);
    await prefs.ensureLoaded(); await prefs.update({ language: 'fr' });
    const before = await storage.getItem(StorageKeys.userPreferences.key);
    storage.fail = true;
    await assert.rejects(() => prefs.update({ language: 'en' }), /disk full/);
    await assert.rejects(() => prefs.resetPreferences(), /disk full/);
    assert.equal(prefs.getPreferences().language, 'fr'); assert.equal(await storage.getItem(StorageKeys.userPreferences.key), before);
    storage.fail = false;
    await Promise.all([prefs.update({ language: 'en' }), prefs.update({ voiceEnabled: false })]);
    assert.equal(prefs.getPreferences().language,'en'); assert.equal(prefs.getPreferences().voiceEnabled,false);
  });
  it('distinguishes an unreadable preference document from a missing one and retries without erasing it', async () => {
    class FaultStorage extends MemoryKeyValueStorage {
      fail = false;
      override async getItem(k:string) { if (this.fail && k === StorageKeys.userPreferences.key) throw new Error('read failed'); return super.getItem(k); }
    }
    const storage = new FaultStorage();
    await storage.setItem(StorageKeys.userPreferences.key, JSON.stringify({ language:'en', updatedAt:'2026-01-01' }));
    storage.fail = true;
    await assert.rejects(() => loadStoredJson(storage, StorageKeys.userPreferences.key, {}, value => value as object), /read failed/);
    const prefs = new PreferencesStore(storage); await prefs.ensureLoaded();
    await assert.rejects(() => prefs.update({ language:'fr' }), /preferences_read_failed/);
    storage.fail = false; await prefs.ensureLoaded(); assert.equal(prefs.getPreferences().language,'en');
  });
  it('serializes ordinary writes with merge updates without losing the later mutation', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem('x', 'first');
    await Promise.all([storage.updateItem('x', old => old + '-merged'), storage.setItem('x', 'later')]);
    assert.equal(await storage.getItem('x'), 'later');
    await storage.updateItem('x', old => old + '-cloud'); assert.equal(await storage.getItem('x'), 'later-cloud');
  });
});

describe('owner-bound recovery and avatars', () => {
  it('rejects another owner backup and corrupt backup without any live mutation', async () => {
    const a = await device(new MemoryCloudRemote()); await a.storage.setItem(key, doc(pgn('current')));
    const before = await a.storage.getItem(key);
    await a.storage.setItem('backup', JSON.stringify({ ownerId: 'someone-else', docs: { [key]: doc(pgn('foreign')) } }));
    assert.equal(await restoreBackup(a.storage, 'backup'), false);
    await a.storage.setItem('backup', '{'); assert.equal(await restoreBackup(a.storage, 'backup'), false);
    assert.equal(await a.storage.getItem(key), before);
  });
  it('merges a backup with newer documents and keeps a recovery snapshot without credentials', async () => {
    const a = await device(new MemoryCloudRemote()); await a.storage.setItem(key, doc(pgn('old')));
    const backup = await a.engine.backupLocal();
    await a.storage.setItem(key, doc(pgn('new'))); assert.equal(await restoreBackup(a.storage, backup), true);
    assert.deepEqual((await read(a.storage)).files.map((f:{id:string}) => f.id).sort(), ['new','old']);
    const index = await readBackupIndex(a.storage);
    const recovery = index.find(row => row.key.includes('before-restore'))!;
    assert.match((await a.storage.getItem(recovery.key))!, /new/);
    const contents = JSON.parse((await a.storage.getItem(recovery.key))!);
    assert.deepEqual(Object.keys(contents.docs).sort(), [...SYNCABLE_STORAGE_KEYS].sort());
    assert.equal(contents.docs['anychess.cloud.session.v1'], undefined);
  });
  it('rejects a foreign or corrupt workspace instead of clearing the live documents', async () => {
    const a = await device(new MemoryCloudRemote()); await a.storage.setItem(key, doc(pgn('keep')));
    await a.storage.setItem(cloudWorkspaceKey('B'), JSON.stringify({ ownerId: 'A', docs: {} }));
    await assert.rejects(() => a.engine.restoreWorkspace('B'), /workspace_invalid/);
    assert.match((await a.storage.getItem(key))!, /keep/);
  });
  it('does not clear a newer pending avatar or apply an old account upload result', async () => {
    const storage = new MemoryKeyValueStorage();
    await savePendingAvatar(storage, 'demo@example.com', 'data:image/png;base64,b2xk', 'upload');
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL, previousKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-fixture';
    const entered = gate(), resume = gate(); let current = true;
    const result = flushPendingAvatar({ storage, userId: 'A', email: 'demo@example.com', accessToken: 'demo-token', isCurrent: () => current,
      fetchImpl: async () => { entered.release(); await resume.promise; return new Response('', { status: 200 }); },
      markHasAvatar: async () => { assert.fail('old account result must not update the active profile'); },
    });
    await entered.promise;
    await savePendingAvatar(storage, 'other@example.com', 'data:image/png;base64,bmV3', 'upload'); current = false; resume.release();
    assert.equal(await result, 'skipped'); assert.equal((await readPendingAvatar(storage))!.email, 'other@example.com');
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });
  it('preserves both accounts pending avatars across replacement and clears only the confirmed owner', async () => {
    const storage = new MemoryKeyValueStorage();
    await savePendingAvatar(storage, 'a@example.com', 'data:image/png;base64,QQ==');
    await savePendingAvatar(storage, 'b@example.com', 'data:image/png;base64,Qg==');
    const previousA = await readPendingAvatar(storage, 'a@example.com');
    assert.equal(previousA!.dataUrl, 'data:image/png;base64,QQ==');
    await savePendingAvatar(storage, 'a@example.com', 'data:image/png;base64,Qz==');
    await clearPendingAvatar(storage, 'a@example.com', previousA!);
    assert.equal((await readPendingAvatar(storage, 'a@example.com'))!.dataUrl, 'data:image/png;base64,Qz==');
    await clearPendingAvatar(storage, 'a@example.com');
    assert.equal(await readPendingAvatar(storage, 'a@example.com'), null);
    assert.equal((await readPendingAvatar(storage, 'b@example.com'))!.dataUrl, 'data:image/png;base64,Qg==');
  });
  it('uses deterministic preference conflict resolution in either device order', () => {
    const a = JSON.stringify({ language: 'fr', updatedAt: '2026-01-01' }), b = JSON.stringify({ language: 'en', updatedAt: '2026-01-01' });
    assert.deepEqual(JSON.parse(mergeDocumentPayload(StorageKeys.userPreferences.key, a, b)!), JSON.parse(mergeDocumentPayload(StorageKeys.userPreferences.key, b, a)!));
  });
});

it('translates confirmed sync timestamps in French and English without exposing placeholders', () => {
  assert.equal(translate('fr','cloud.lastSyncedAt',{ date:'22/10/2026' }), 'Dernière synchronisation réussie : 22/10/2026');
  assert.equal(translate('en','cloud.lastSyncedAt',{ date:'22/10/2026' }), 'Last successful sync: 22/10/2026');
});
