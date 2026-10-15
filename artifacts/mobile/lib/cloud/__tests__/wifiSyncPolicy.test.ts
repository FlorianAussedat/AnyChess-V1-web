import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
import { shouldDeferCloudTransfer, transportFromExpoState } from '../wifiSyncPolicy.ts';
import { PreferencesStore, defaultUserPreferences } from '../../preferences/PreferencesStore.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('Wi-Fi only sync policy', () => {
  afterEach(() => {
    setCloudTransferReadersForTests({ transport: null, wifiOnly: null });
  });

  it('defers only a known cellular link when the setting is on', () => {
    assert.equal(shouldDeferCloudTransfer({ wifiOnly: true, transport: 'cellular' }), true);
    assert.equal(shouldDeferCloudTransfer({ wifiOnly: true, transport: 'wifi' }), false);
    assert.equal(shouldDeferCloudTransfer({ wifiOnly: false, transport: 'cellular' }), false);
    assert.equal(
      shouldDeferCloudTransfer({ wifiOnly: true, transport: 'cellular', allowCellular: true }),
      false,
    );
    assert.equal(shouldDeferCloudTransfer({ wifiOnly: true, transport: 'unknown' }), false);
    assert.equal(shouldDeferCloudTransfer({ wifiOnly: true, transport: 'offline' }), false);
    assert.equal(transportFromExpoState({ type: 'CELLULAR', isConnected: true }), 'cellular');
    assert.equal(transportFromExpoState({ type: 'WIMAX', isConnected: true }), 'cellular');
    assert.equal(transportFromExpoState({ type: 'WIFI', isConnected: true }), 'wifi');
    assert.equal(transportFromExpoState({ type: 'ETHERNET', isConnected: true }), 'wifi');
    assert.equal(transportFromExpoState({ type: 'NONE', isConnected: true }), 'offline');
    assert.equal(transportFromExpoState({ type: 'WIFI', isConnected: false }), 'offline');
    assert.equal(transportFromExpoState({ type: 'VPN', isConnected: true }), 'unknown');
  });

  it('defaults the setting on and keeps an explicit off choice', async () => {
    assert.equal(defaultUserPreferences().syncOnWifiOnly, true);
    const storage = new MemoryKeyValueStorage();
    const store = new PreferencesStore(storage);
    await store.ensureLoaded();
    assert.equal(store.getPreferences().syncOnWifiOnly, true);
    await storage.setItem(
      StorageKeys.userPreferences.key,
      JSON.stringify({ version: 1, language: 'fr', updatedAt: '2026-01-01T00:00:00.000Z' }),
    );
    const legacy = new PreferencesStore(storage);
    await legacy.ensureLoaded();
    assert.equal(legacy.getPreferences().syncOnWifiOnly, true);
    await legacy.update({ syncOnWifiOnly: false });
    const again = new PreferencesStore(storage);
    await again.ensureLoaded();
    assert.equal(again.getPreferences().syncOnWifiOnly, false);
  });

  it('signs in on mobile data, keeps the session, and syncs when Wi-Fi returns', async () => {
    setCloudTransferReadersForTests({
      transport: async () => 'cellular',
      wifiOnly: async () => true,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    const created = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await storage.setItem(
      StorageKeys.repertoires.key,
      JSON.stringify({ version: 2, folders: [], files: [{ id: 'local-line' }] }),
    );
    assert.equal(engine.getState().user?.email, 'alice@example.com');
    assert.equal(engine.getState().status, 'waiting_wifi');
    assert.equal(remote.peek(created.user.id, StorageKeys.repertoires.key), undefined);

    await engine.sync({ allowCellular: true });
    assert.equal(engine.getState().status, 'synced');
    assert.match(
      remote.peek(created.user.id, StorageKeys.repertoires.key)?.payload ?? '',
      /local-line/,
    );

    setCloudTransferReadersForTests({
      transport: async () => 'cellular',
      wifiOnly: async () => true,
    });
    engine.notifyLocalMutation();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(engine.getState().status, 'waiting_wifi');

    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => true,
    });
    await engine.sync();
    assert.equal(engine.getState().status, 'synced');
    assert.equal(engine.getState().user?.id, created.user.id);
  });

  it('exposes the setting and the waiting status without blocking sign-in copy', () => {
    const settings = read('app/parametres.tsx');
    const account = read('components/cloud/CloudAccountSection.tsx');
    assert.match(settings, /parametres-sync-wifi-only/);
    assert.match(settings, /settings\.syncWifiOnly/);
    assert.match(account, /cloud\.statusWaitingWifi/);
    assert.match(account, /allowCellular: true/);
    assert.match(account, /cloud\.signIn/);
    assert.match(read('lib/cloud/lifecycle.ts'), /onSyncTransportChange/);
    assert.doesNotMatch(read('lib/cloud/lifecycle.ts'), /markWaitingForWifi/);
  });
});
