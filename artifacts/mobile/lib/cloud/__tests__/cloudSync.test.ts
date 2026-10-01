import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine, restoreBackup } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import { mergeDocumentPayload, mergeUserPreferences } from '../mergeDocuments.ts';
import type { CloudAuth, CloudDocument, CloudUser } from '../types.ts';
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

function preferenceDoc(partial: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    language: 'fr',
    chessNotation: 'fr',
    voiceEnabled: true,
    updatedAt: '2020-01-01T00:00:00.000Z',
    ...partial,
  });
}

describe('preference sync rule', () => {
  it('keeps the guest document when the account has no remote preferences yet', () => {
    const local = preferenceDoc({
      language: 'en',
      chessNotation: 'en',
      voiceEnabled: false,
      preferencesOrigin: 'device',
      manualFields: [],
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    assert.equal(
      mergeDocumentPayload(StorageKeys.userPreferences.key, local, null),
      local,
    );
    const kept = mergeUserPreferences(JSON.parse(local), null) as { language: string };
    assert.equal(kept.language, 'en');
  });

  it('does not let phone defaults replace an existing cloud preference', () => {
    const local = preferenceDoc({
      language: 'en',
      chessNotation: 'fr',
      voiceEnabled: true,
      preferencesOrigin: 'device',
      manualFields: [],
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    const remote = preferenceDoc({
      language: 'fr',
      chessNotation: 'en',
      voiceEnabled: false,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const merged = JSON.parse(
      mergeDocumentPayload(StorageKeys.userPreferences.key, local, remote) ?? '{}',
    ) as { language: string; chessNotation: string; voiceEnabled: boolean };
    assert.equal(merged.language, 'fr');
    assert.equal(merged.chessNotation, 'en');
    assert.equal(merged.voiceEnabled, false);
  });

  it('keeps last-write-wins for preferences saved before the phone-default flag', () => {
    const local = preferenceDoc({
      language: 'en',
      voiceEnabled: false,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const remote = preferenceDoc({
      language: 'fr',
      voiceEnabled: true,
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const merged = JSON.parse(
      mergeDocumentPayload(StorageKeys.userPreferences.key, local, remote) ?? '{}',
    ) as { language: string; voiceEnabled: boolean };
    assert.equal(merged.language, 'en');
    assert.equal(merged.voiceEnabled, false);
  });

  it('keeps a guest change and the rest of the cloud preferences', () => {
    const local = preferenceDoc({
      language: 'en',
      voiceEnabled: true,
      chessNotation: 'fr',
      preferencesOrigin: 'device',
      manualFields: ['language'],
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    const remote = preferenceDoc({
      language: 'fr',
      voiceEnabled: false,
      chessNotation: 'en',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    const merged = JSON.parse(
      mergeDocumentPayload(StorageKeys.userPreferences.key, local, remote) ?? '{}',
    ) as { language: string; chessNotation: string; voiceEnabled: boolean };
    assert.equal(merged.language, 'en');
    assert.equal(merged.voiceEnabled, false);
    assert.equal(merged.chessNotation, 'en');
  });

  it('uploads guest settings for a new account and preserves cloud settings for an existing one', async () => {
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const firstPhone = new MemoryKeyValueStorage();
    const existing = new CloudSyncEngine(firstPhone, auth, remote);
    await firstPhone.setItem(
      StorageKeys.userPreferences.key,
      preferenceDoc({
        language: 'fr',
        chessNotation: 'en',
        voiceEnabled: false,
        updatedAt: '2024-01-01T00:00:00.000Z',
      }),
    );
    const created = await existing.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, true);

    const guestPhone = new MemoryKeyValueStorage();
    const guest = new CloudSyncEngine(guestPhone, auth, remote);
    await guestPhone.setItem(
      StorageKeys.userPreferences.key,
      preferenceDoc({
        language: 'en',
        chessNotation: 'fr',
        voiceEnabled: true,
        preferencesOrigin: 'device',
        manualFields: [],
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    const signed = await guest.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, true);
    const stored = JSON.parse(
      (await guestPhone.getItem(StorageKeys.userPreferences.key)) ?? '{}',
    ) as { language: string; chessNotation: string; voiceEnabled: boolean };
    assert.equal(stored.language, 'fr');
    assert.equal(stored.chessNotation, 'en');
    assert.equal(stored.voiceEnabled, false);

    await guest.signOut();
    const fresh = new MemoryKeyValueStorage();
    const freshRemote = new MemoryCloudRemote();
    const createdEngine = new CloudSyncEngine(fresh, new MemoryCloudAuth(), freshRemote);
    await fresh.setItem(
      StorageKeys.userPreferences.key,
      preferenceDoc({
        language: 'en',
        chessNotation: 'en',
        voiceEnabled: false,
        preferencesOrigin: 'device',
        manualFields: ['language', 'chessNotation', 'voiceEnabled'],
        updatedAt: '2026-10-01T00:00:00.000Z',
      }),
    );
    const signup = await createdEngine.signUp('new@example.com', 'secret1');
    assert.equal(signup.ok, true);
    if (!signup.ok) return;
    const uploaded = JSON.parse(
      freshRemote.peek(signup.user.id, StorageKeys.userPreferences.key)?.payload ?? '{}',
    ) as { language: string; voiceEnabled: boolean; chessNotation: string };
    assert.equal(uploaded.language, 'en');
    assert.equal(uploaded.chessNotation, 'en');
    assert.equal(uploaded.voiceEnabled, false);
  });
});

describe('session restore', () => {
  it('keeps an established session and local settings when the network fails', async () => {
    const storage = new MemoryKeyValueStorage();
    const saved = preferenceDoc({
      language: 'fr',
      voiceEnabled: false,
      updatedAt: '2024-05-01T00:00:00.000Z',
    });
    await storage.setItem(StorageKeys.userPreferences.key, saved);
    const user: CloudUser = { id: 'u1', email: 'a@b.c' };
    const auth: CloudAuth = {
      configured: true,
      token: () => 'token-1',
      async hydrate() {
        return user;
      },
      async getUser() {
        return user;
      },
      async signUp() {
        return { ok: false, error: 'unexpected' };
      },
      async signIn() {
        return { ok: true, user };
      },
      async signOut() {},
      async resendSignupConfirmation() {
        return { ok: true };
      },
      async recoverPassword() {
        return { ok: true };
      },
    };
    const engine = new CloudSyncEngine(storage, auth, {
      async listDocuments() {
        throw new Error('network offline');
      },
      async upsertDocument() {
        throw new Error('network offline');
      },
    });
    assert.equal(engine.getState().sessionReady, false);
    const state = await engine.hydrate();
    assert.equal(state.sessionReady, true);
    assert.equal(state.status, 'offline');
    assert.equal(state.user?.email, 'a@b.c');
    assert.equal(await storage.getItem(StorageKeys.userPreferences.key), saved);
  });
});
