/**
 * Account A must not be displayed or uploaded as account B or as the guest.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { savePendingAvatar } from '../../profile/avatarLocal.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { writeDeletionPending } from '../purgeAccountLocal.ts';
import {
  CLOUD_ACTIVE_USER_KEY,
  CLOUD_LEGACY_GUEST_KEY,
  DEVICE_PREFERENCES_KEY,
  cloudWorkspaceKey,
} from '../syncableKeys.ts';
import type { CloudDocument } from '../types.ts';

const here = dirname(fileURLToPath(import.meta.url));

function repertoire(id: string, pgnText: string) {
  return JSON.stringify({
    version: 2,
    folders: [],
    files: [{ id, filename: `${id}.pgn`, pgnText }],
  });
}

function prefs(partial: Record<string, unknown>) {
  return JSON.stringify({
    version: 1,
    language: 'fr',
    syncOnWifiOnly: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  });
}

function waitFor(check: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > 2000) {
        clearInterval(timer);
        reject(new Error('timed out'));
      }
    }, 10);
  });
}

function liveBlob(storage: MemoryKeyValueStorage): Promise<string> {
  return Promise.all([
    storage.getItem(StorageKeys.repertoires.key),
    storage.getItem(StorageKeys.openingQuizRecords.key),
    storage.getItem(StorageKeys.userProfile.key),
  ]).then((parts) => parts.filter(Boolean).join('\n'));
}

describe('account isolation', () => {
  it('keeps A parked across sign-out, B, and the return to A', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);

    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    await storage.setItem(StorageKeys.repertoires.key, repertoire('alice-file', '1. e4 *'));
    await storage.setItem(StorageKeys.openingQuizRecords.key, JSON.stringify({ bestByDifficulty: { facile: 4 } }));
    await storage.setItem(StorageKeys.userPreferences.key, prefs({ language: 'fr', syncOnWifiOnly: false }));
    await engine.sync();

    const signedOut = await engine.signOut();
    assert.equal(signedOut.ok, true);
    const afterOut = await liveBlob(storage);
    assert.equal(afterOut.includes('alice-file'), false);
    assert.equal(afterOut.includes('facile'), false);
    assert.match((await storage.getItem(cloudWorkspaceKey(alice.user.id))) ?? '', /alice-file/);
    assert.doesNotMatch((await storage.getItem(cloudWorkspaceKey('guest'))) ?? '', /alice-file/);

    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    const bobLive = await liveBlob(storage);
    assert.equal(bobLive.includes('alice-file'), false);
    assert.equal(bobLive.includes('facile'), false);
    assert.equal(
      remote.peek(bob.user.id, StorageKeys.repertoires.key)?.payload?.includes('alice-file') ?? false,
      false,
    );

    await storage.setItem(StorageKeys.repertoires.key, repertoire('bob-file', '1. d4 *'));
    await engine.sync();
    await engine.signOut();
    const aliceAgain = await engine.signIn('alice@example.com', 'secret1');
    assert.equal(aliceAgain.ok, true);
    const restored = await liveBlob(storage);
    assert.match(restored, /alice-file/);
    assert.match(restored, /facile/);
    assert.doesNotMatch(restored, /bob-file/);
    assert.equal(
      remote.peek(bob.user.id, StorageKeys.repertoires.key)?.payload?.includes('alice-file') ?? false,
      false,
    );
  });

  it('does not upload A while B is offline, including after a restart', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const inner = new MemoryCloudRemote();
    let offline = false;
    const remote = {
      async listDocuments(userId: string) {
        if (offline) throw new Error('network offline');
        return inner.listDocuments(userId);
      },
      async upsertDocument(userId: string, doc: CloudDocument) {
        if (offline) throw new Error('network offline');
        await inner.upsertDocument(userId, doc);
      },
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    await storage.setItem(StorageKeys.repertoires.key, repertoire('alice-file', '1. e4 *'));
    await engine.sync();
    await engine.signOut();

    const restarted = new CloudSyncEngine(storage, auth, remote);
    offline = true;
    const bob = await restarted.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    assert.equal(restarted.getState().status, 'offline');
    assert.equal((await liveBlob(storage)).includes('alice-file'), false);
    offline = false;
    await restarted.sync();
    assert.equal(
      inner.peek(bob.user.id, StorageKeys.repertoires.key)?.payload?.includes('alice-file') ?? false,
      false,
    );
    await restarted.signOut();
    await restarted.signIn('alice@example.com', 'secret1');
    assert.match(await liveBlob(storage), /alice-file/);
  });

  it('drops an in-flight response from A after B is signed in', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const inner = new MemoryCloudRemote();
    let release = () => {};
    let listed = false;
    let block = false;
    const uploads: { userId: string; payload: string | null }[] = [];
    const remote = {
      async listDocuments(userId: string) {
        if (block && userId === aliceId) {
          listed = true;
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return inner.listDocuments(userId);
      },
      async upsertDocument(userId: string, doc: CloudDocument) {
        uploads.push({ userId, payload: doc.payload });
        await inner.upsertDocument(userId, doc);
      },
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    const aliceId = alice.user.id;
    await inner.upsertDocument(alice.user.id, {
      docKey: StorageKeys.repertoires.key,
      payload: repertoire('alice-remote', '1. e4 e5 *'),
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
      revision: 1,
    });
    await storage.setItem(StorageKeys.repertoires.key, repertoire('alice-local', '1. e4 *'));
    block = true;
    const pending = engine.sync();
    await waitFor(() => listed);
    await engine.signOut();
    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    block = false;
    release();
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const bobLive = await liveBlob(storage);
    assert.equal(bobLive.includes('alice-local'), false);
    assert.equal(bobLive.includes('alice-remote'), false);
    assert.equal(
      uploads.some((item) => item.userId === bob.user.id && (item.payload ?? '').includes('alice-')),
      false,
    );
    await engine.signOut();
    await engine.signIn('alice@example.com', 'secret1');
    assert.match(await liveBlob(storage), /alice-local|alice-remote/);
  });

  it('loads an empty B and an already filled B without A', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    await storage.setItem(StorageKeys.repertoires.key, repertoire('alice-file', '1. e4 *'));
    await engine.sync();
    await engine.signOut();

    const emptyBob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(emptyBob.ok, true);
    if (!emptyBob.ok) return;
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), null);
    await engine.signOut();

    await remote.upsertDocument(emptyBob.user.id, {
      docKey: StorageKeys.repertoires.key,
      payload: repertoire('bob-cloud', '1. c4 *'),
      updatedAt: '2026-02-01T00:00:00.000Z',
      deletedAt: null,
      revision: 2,
    });
    await engine.signIn('bob@example.com', 'secret2');
    const bobLive = await storage.getItem(StorageKeys.repertoires.key);
    assert.match(bobLive ?? '', /bob-cloud/);
    assert.doesNotMatch(bobLive ?? '', /alice-file/);
  });

  it('keeps a pending deletion and a pending avatar on their owner', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    await storage.setItem(StorageKeys.repertoires.key, repertoire('alice-file', '1. e4 *'));
    await engine.sync();
    await savePendingAvatar(storage, 'alice@example.com', 'data:image/png;base64,aaaa');
    await writeDeletionPending(storage, { userId: alice.user.id, email: 'alice@example.com' });
    await engine.signOut();
    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    assert.equal(engine.getState().user?.id, bob.user.id);
    assert.match((await storage.getItem(cloudWorkspaceKey(alice.user.id))) ?? '', /alice-file/);
    assert.equal((await liveBlob(storage)).includes('alice-file'), false);
    const pending = await storage.getItem('anychess.avatar.pending.v1');
    assert.match(pending ?? '', /alice@example.com/);
    assert.equal(await storage.getItem('anychess.avatar.cache.' + bob.user.id), null);
  });

  it('imports guest data only when asked, and keeps the phone Wi-Fi setting', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(StorageKeys.repertoires.key, repertoire('guest-file', '1. a3 *'));
    await storage.setItem(StorageKeys.userPreferences.key, prefs({ language: 'en', syncOnWifiOnly: false }));
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    assert.equal((await liveBlob(storage)).includes('guest-file'), false);
    assert.equal(remote.peek(alice.user.id, StorageKeys.repertoires.key), undefined);
    const imported = await engine.importGuestData();
    assert.equal(imported.ok, true);
    assert.match(await liveBlob(storage), /guest-file/);
    assert.match(remote.peek(alice.user.id, StorageKeys.repertoires.key)?.payload ?? '', /guest-file/);
    assert.match((await storage.getItem(cloudWorkspaceKey('guest'))) ?? '', /guest-file/);

    await storage.setItem(StorageKeys.userPreferences.key, prefs({ language: 'fr', syncOnWifiOnly: false }));
    await engine.sync();
    await engine.signOut();
    assert.equal(JSON.parse((await storage.getItem(DEVICE_PREFERENCES_KEY)) ?? '{}').syncOnWifiOnly, false);

    const bob = auth.seed('bob@example.com', 'secret2');
    await storage.setItem(
      cloudWorkspaceKey(bob.id),
      JSON.stringify({
        ownerId: bob.id,
        origin: 'account',
        docs: { [StorageKeys.userPreferences.key]: prefs({ language: 'en', syncOnWifiOnly: true }) },
      }),
    );
    await engine.signIn('bob@example.com', 'secret2');
    const bobPrefs = JSON.parse((await storage.getItem(StorageKeys.userPreferences.key)) ?? '{}') as {
      language: string;
      syncOnWifiOnly: boolean;
    };
    assert.equal(bobPrefs.language, 'en');
    assert.equal(bobPrefs.syncOnWifiOnly, false);
    assert.equal((await liveBlob(storage)).includes('guest-file'), false);
  });

  it('does not assign a legacy copy of A to the next account', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const aliceDocs = { [StorageKeys.repertoires.key]: repertoire('alice-file', '1. e4 *') };
    await storage.setItem(
      cloudWorkspaceKey('user_a'),
      JSON.stringify({ ownerId: 'user_a', docs: aliceDocs }),
    );
    await storage.setItem(
      cloudWorkspaceKey('guest'),
      JSON.stringify({ ownerId: 'guest', docs: aliceDocs }),
    );
    await storage.setItem(StorageKeys.repertoires.key, aliceDocs[StorageKeys.repertoires.key]!);
    await storage.setItem(CLOUD_ACTIVE_USER_KEY, 'guest');
    auth.seed('alice@example.com', 'secret1', 'user_a');
    const engine = new CloudSyncEngine(storage, auth, remote);
    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    assert.equal((await liveBlob(storage)).includes('alice-file'), false);
    assert.equal(
      remote.peek(bob.user.id, StorageKeys.repertoires.key)?.payload?.includes('alice-file') ?? false,
      false,
    );
    assert.match((await storage.getItem(CLOUD_LEGACY_GUEST_KEY)) ?? '', /alice-file/);
    assert.match((await storage.getItem(cloudWorkspaceKey('user_a'))) ?? '', /alice-file/);
    assert.doesNotMatch((await storage.getItem(cloudWorkspaceKey('guest'))) ?? '', /alice-file/);
  });

  it('records that Supabase policies cannot stop a client from mislabeling its own rows', () => {
    const repo = join(here, '../../../../..');
    const documents = readFileSync(join(repo, 'supabase/user_documents.sql'), 'utf8');
    const avatars = readFileSync(join(repo, 'supabase/avatars.sql'), 'utf8');
    assert.match(documents, /using \(auth\.uid\(\) = user_id\)/);
    assert.match(documents, /with check \(auth\.uid\(\) = user_id\)/);
    assert.match(avatars, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/);
    assert.doesNotMatch(documents, /service_role/);
  });
});
