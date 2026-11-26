import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { cloudSyncEngine } from '../cloudStore.ts';
import { onSyncTransportChange } from '../lifecycle.ts';
import { savePendingAvatar, readPendingAvatar } from '../../profile/avatarLocal.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { decideCloudTransfer, setCloudTransferReadersForTests } from '../syncTransport.ts';
import { shouldDeferCloudTransfer, transportFromExpoState } from '../wifiSyncPolicy.ts';
import { PreferencesStore, defaultUserPreferences } from '../../preferences/PreferencesStore.ts';

const engines: CloudSyncEngine[] = [];
afterEach(async () => {
  for (const engine of engines.splice(0)) await engine.signOut();
  setCloudTransferReadersForTests({ transport: null, wifiOnly: null });
});
async function connected() {
  const storage = new MemoryKeyValueStorage();
  const remote = new MemoryCloudRemote();
  const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), remote);
  engines.push(engine);
  const result = await engine.signUp('alice@example.com', 'secret1');
  assert.ok(result.ok);
  return { storage, remote, engine, user: result.user };
}

describe('transfers on any Internet connection', () => {
  it('never defers cellular data because of legacy preferences or overrides', async () => {
    for (const transport of ['wifi', 'cellular', 'unknown', 'offline'] as const) {
      for (const wifiOnly of [true, false]) {
        assert.equal(shouldDeferCloudTransfer({ wifiOnly, transport }), false);
        setCloudTransferReadersForTests({ transport: async () => transport, wifiOnly: async () => wifiOnly });
        const decision = await decideCloudTransfer();
        assert.equal(decision.defer, false);
        assert.equal(decision.wifiOnly, false);
        assert.equal(decision.offline, transport === 'offline');
      }
    }
    assert.equal(transportFromExpoState({ type: 'CELLULAR', isConnected: true }), 'cellular');
    assert.equal(transportFromExpoState({ type: 'ETHERNET', isConnected: true }), 'wifi');
    assert.equal(transportFromExpoState({ type: 'NONE' }), 'offline');
    assert.equal(transportFromExpoState({ type: 'WIFI', isConnected: false }), 'offline');
  });

  it('normalizes missing and old true values to false, including reset and restart', async () => {
    assert.equal(defaultUserPreferences().syncOnWifiOnly, false);
    for (const legacy of [{}, { syncOnWifiOnly: true }, { syncOnWifiOnly: false }]) {
      const storage = new MemoryKeyValueStorage();
      await storage.setItem(StorageKeys.userPreferences.key, JSON.stringify({ language: 'en', ...legacy }));
      const store = new PreferencesStore(storage);
      assert.equal((await store.ensureLoaded()).syncOnWifiOnly, false);
      await store.update({ syncOnWifiOnly: true });
      assert.equal((await store.resetPreferences()).syncOnWifiOnly, false);
      assert.equal((await new PreferencesStore(storage).ensureLoaded()).syncOnWifiOnly, false);
    }
  });

  it('uploads documents and queues local changes on cellular with an old true preference', async () => {
    setCloudTransferReadersForTests({ transport: async () => 'cellular', wifiOnly: async () => true });
    const { storage, remote, engine, user } = await connected();
    assert.equal(engine.getState().status, 'synced');
    await storage.setItem(StorageKeys.repertoires.key, JSON.stringify({ version: 2, folders: [], files: [{ id: 'local-line' }] }));
    engine.notifyLocalMutation();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(engine.getState().status, 'pending');
    await engine.sync();
    assert.equal(engine.getState().status, 'synced');
    assert.match(remote.peek(user.id, StorageKeys.repertoires.key)?.payload ?? '', /local-line/);
  });

  it('keeps offline data local until cellular returns and exposes transfer errors', async () => {
    setCloudTransferReadersForTests({ transport: async () => 'offline', wifiOnly: async () => true });
    const { storage, remote, engine, user } = await connected();
    const payload = JSON.stringify({ version: 2, folders: [], files: [{ id: 'offline-line' }] });
    await storage.setItem(StorageKeys.repertoires.key, payload);
    engine.notifyLocalMutation();
    await engine.sync();
    assert.equal(engine.getState().status, 'offline');
    assert.equal(remote.peek(user.id, StorageKeys.repertoires.key), undefined);
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), payload);
    setCloudTransferReadersForTests({ transport: async () => 'cellular' });
    remote.upsertDocument = async () => { throw new Error('HTTP 503'); };
    await engine.sync();
    assert.equal(engine.getState().status, 'error');
    assert.equal(engine.getState().lastError, 'sync_failed');
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), payload);
    delete (remote as Partial<MemoryCloudRemote>).upsertDocument;
    await engine.sync();
    assert.equal(engine.getState().status, 'synced');
    assert.match(remote.peek(user.id, StorageKeys.repertoires.key)?.payload ?? '', /offline-line/);
  });
  it('resumes pending work on cellular as well as Wi-Fi, never on offline notifications', () => {
    const getState = cloudSyncEngine.getState, sync = cloudSyncEngine.sync;
    let calls = 0;
    cloudSyncEngine.getState = () => ({ ...getState.call(cloudSyncEngine), status: 'offline', user: { id: 'a', email: 'a@example.com' } });
    cloudSyncEngine.sync = async () => { calls++; return cloudSyncEngine.getState(); };
    try {
      onSyncTransportChange('offline');
      assert.equal(calls, 0);
      onSyncTransportChange('cellular');
      onSyncTransportChange('wifi');
      assert.equal(calls, 2);
    } finally {
      cloudSyncEngine.getState = getState;
      cloudSyncEngine.sync = sync;
    }
  });

  it('retains pending avatar transfers and exposes failure instead of reporting synced', async () => {
    setCloudTransferReadersForTests({ transport: async () => 'cellular', wifiOnly: async () => true });
    const { engine, storage, user } = await connected();
    await savePendingAvatar(storage, user.email, 'data:image/png;base64,bmV3', 'upload');
    await engine.sync(); // Memory auth has no owner token: transfer must fail, never clear intent.
    assert.equal(engine.getState().status, 'error');
    assert.equal(engine.getState().lastError, 'avatar_transfer_failed');
    assert.equal((await readPendingAvatar(storage))?.intent, 'upload');
  });

});
