import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine, restoreBackup } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { mergeDocumentPayload } from '../mergeDocuments.ts';
import type { CloudDocument } from '../types.ts';
import { assertNoDeepLKeyInCloudConfig } from '../supabaseConfig.ts';
import { SYNCABLE_STORAGE_KEYS, cloudBackupKey } from '../syncableKeys.ts';

const here = dirname(fileURLToPath(import.meta.url));

function repertoire(files: { id: string; filename: string; pgnText: string }[]) {
  return JSON.stringify({
    version: 2,
    folders: [{ id: 'f1', name: 'Sicilienne', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
    files: files.map((file) => ({
      ...file,
      folderId: 'f1',
      importedAt: '2026-01-01',
      summary: { gameCount: 1, positionCount: 1, branchCount: 0, parseSucceeded: true, errors: [], warnings: [] },
    })),
  });
}

describe('cloud document merge', () => {
  it('does not resurrect a PGN deleted on another device', () => {
    const local = JSON.stringify({
      version: 2,
      folders: [{ id: 'f1', name: 'Sicilienne', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
      files: [],
      syncDeletedIds: ['gone'],
    });
    const remote = repertoire([{ id: 'gone', filename: 'old.pgn', pgnText: '1. e4 *' }]);
    const merged = JSON.parse(mergeDocumentPayload(StorageKeys.repertoires.key, local, remote) ?? '{}') as {
      files: { id: string }[];
      syncDeletedIds: string[];
    };
    assert.deepEqual(merged.files, []);
    assert.ok(merged.syncDeletedIds.includes('gone'));
  });

  it('keeps both PGN files and drops an identical duplicate', () => {
    const local = repertoire([
      { id: 'a', filename: 'a.pgn', pgnText: '1. e4 e5 *' },
      { id: 'b', filename: 'b.pgn', pgnText: '1. d4 d5 *' },
    ]);
    const remote = repertoire([
      { id: 'a', filename: 'a.pgn', pgnText: '1. e4 e5 *' },
      { id: 'c', filename: 'c.pgn', pgnText: '1. c4 c5 *' },
    ]);
    const merged = JSON.parse(mergeDocumentPayload(StorageKeys.repertoires.key, local, remote) ?? '{}') as {
      files: { id: string }[];
    };
    assert.deepEqual(merged.files.map((f) => f.id).sort(), ['a', 'b', 'c']);
  });
});

describe('account sync engine', () => {
  it('backs up, migrates local PGN to a new account, and restores on a blank install', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(
      StorageKeys.repertoires.key,
      repertoire([{ id: 'local1', filename: 'najdorf.pgn', pgnText: '1. e4 c5 *' }]),
    );
    await storage.setItem(
      StorageKeys.userPreferences.key,
      JSON.stringify({ version: 1, language: 'fr', updatedAt: '2026-01-01T00:00:00.000Z' }),
    );

    const created = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(created.ok, true);
    assert.ok(engine.getState().lastBackupKey?.startsWith('anychess.cloud.backup.'));
    const backupRaw = await storage.getItem(engine.getState().lastBackupKey!);
    assert.match(backupRaw ?? '', /najdorf/);

    const uploaded = remote.peek(created.ok ? created.user.id : '', StorageKeys.repertoires.key);
    assert.match(uploaded?.payload ?? '', /najdorf/);

    const otherPhone = new MemoryKeyValueStorage();
    const engine2 = new CloudSyncEngine(otherPhone, auth, remote);
    const signed = await engine2.signIn('alice@example.com', 'secret1');
    assert.equal(signed.ok, true);
    const restored = await otherPhone.getItem(StorageKeys.repertoires.key);
    assert.match(restored ?? '', /najdorf/);
    assert.match(restored ?? '', /local1/);
    assert.equal(engine2.getState().status, 'synced');
  });

  it('isolates two accounts and does not leak PGN', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(
      StorageKeys.repertoires.key,
      repertoire([{ id: 'alice-pgn', filename: 'alice.pgn', pgnText: '1. e4 *' }]),
    );
    await engine.signUp('alice@example.com', 'secret1');
    await engine.signOut();

    await storage.setItem(
      StorageKeys.repertoires.key,
      repertoire([{ id: 'guest-pgn', filename: 'guest.pgn', pgnText: '1. d4 *' }]),
    );
    await engine.signUp('bob@example.com', 'secret2');
    const bobLocal = await storage.getItem(StorageKeys.repertoires.key);
    assert.match(bobLocal ?? '', /guest-pgn|bob|d4/);
    assert.doesNotMatch(bobLocal ?? '', /alice-pgn/);
    assert.equal(remote.peek((await auth.getUser())!.id, StorageKeys.repertoires.key)?.payload?.includes('alice-pgn'), false);

    await engine.signOut();
    await engine.signIn('alice@example.com', 'secret1');
    const aliceAgain = await storage.getItem(StorageKeys.repertoires.key);
    assert.match(aliceAgain ?? '', /alice-pgn/);
    assert.doesNotMatch(aliceAgain ?? '', /guest-pgn/);
  });

  it('can restore a pre-login backup after a bad merge', async () => {
    const storage = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), new MemoryCloudRemote());
    const original = repertoire([{ id: 'keep', filename: 'keep.pgn', pgnText: '1. e4 e5 *' }]);
    await storage.setItem(StorageKeys.repertoires.key, original);
    const key = await engine.backupLocal();
    await storage.setItem(StorageKeys.repertoires.key, repertoire([]));
    assert.equal(await restoreBackup(storage, key), true);
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), original);
    assert.match(key, new RegExp(cloudBackupKey('').replace('.v1', '')));
  });

  it('stays usable offline and syncs when the remote returns', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const inner = new MemoryCloudRemote();
    let fail = true;
    const remote = {
      listDocuments: async (userId: string) => {
        if (fail) throw new Error('network offline');
        return inner.listDocuments(userId);
      },
      upsertDocument: async (userId: string, doc: CloudDocument) => {
        if (fail) throw new Error('network offline');
        return inner.upsertDocument(userId, doc);
      },
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(
      StorageKeys.repertoires.key,
      repertoire([{ id: 'offline1', filename: 'offline.pgn', pgnText: '1. e4 e5 *' }]),
    );
    await engine.signUp('offline@example.com', 'secret1');
    assert.equal(engine.getState().status, 'offline');
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /offline1/);
    fail = false;
    await engine.sync();
    assert.equal(engine.getState().status, 'synced');
    assert.match(inner.peek((await auth.getUser())!.id, StorageKeys.repertoires.key)?.payload ?? '', /offline1/);
  });

  it('never ships a DeepL key in the cloud client and covers every syncable document', () => {
    assert.equal(assertNoDeepLKeyInCloudConfig(), true);
    assert.ok(SYNCABLE_STORAGE_KEYS.includes(StorageKeys.pgnCommentTranslations.key));
    assert.ok(SYNCABLE_STORAGE_KEYS.includes(StorageKeys.openingLineMastery.key));
    const live = readFileSync(join(here, '../SupabaseCloud.ts'), 'utf8');
    const config = readFileSync(join(here, '../supabaseConfig.ts'), 'utf8');
    assert.doesNotMatch(live, /DEEPL_API_KEY|api-free\.deepl/);
    assert.doesNotMatch(config, /DEEPL_API_KEY/);
    assert.match(config, /process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
    assert.match(config, /process\.env\.EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(config, /process\.env\.EXPO_PUBLIC_AUTH_CONFIRM_URL/);
    const utilisateur = readFileSync(join(here, '../../../app/utilisateur.tsx'), 'utf8');
    assert.match(utilisateur, /CloudAccountSection/);
    const layout = readFileSync(join(here, '../../../app/_layout.tsx'), 'utf8');
    assert.match(layout, /bindCloudLifecycle/);
    const sql = readFileSync(join(here, '../../../../../supabase/user_documents.sql'), 'utf8');
    assert.match(sql, /auth\.uid\(\) = user_id/);
    assert.doesNotMatch(sql, /service_role/);
    assert.doesNotMatch(sql, /deepl|api-free\.deepl/i);
  });
});
