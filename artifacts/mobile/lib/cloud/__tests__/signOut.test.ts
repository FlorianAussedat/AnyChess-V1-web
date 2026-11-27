/**
 * Sign-out clears the local session without waiting on the network,
 * keeps parked PGN and scores, and does not upload them to the next account.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { SupabaseCloudAuth } from '../SupabaseCloud.ts';
import type { CloudAuth, CloudDocument, CloudUser } from '../types.ts';
import {
  CLOUD_SESSION_KEY,
  cloudWorkspaceKey,
} from '../syncableKeys.ts';

function repertoire(id: string, pgnText: string) {
  return JSON.stringify({
    version: 2,
    folders: [{ id: 'f1', name: 'Parties', createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
    files: [
      {
        id,
        filename: `${id}.pgn`,
        pgnText,
        folderId: 'f1',
        importedAt: '2026-01-01',
        summary: { gameCount: 1, positionCount: 1, branchCount: 0, parseSucceeded: true, errors: [], warnings: [] },
      },
    ],
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
        reject(new Error('timed out waiting for sync to reach the network'));
      }
    }, 10);
  });
}

describe('sign-out session', () => {
  it('finishes locally while the Supabase logout request never returns', async () => {
    const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'public-anon';
    const storage = new MemoryKeyValueStorage();
    const session = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: { id: 'user-1', email: 'ada@example.com' },
    };
    await storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(session));
    const auth = new SupabaseCloudAuth({
      async load() {
        const raw = await storage.getItem(CLOUD_SESSION_KEY);
        return raw ? (JSON.parse(raw) as typeof session) : null;
      },
      async save(next) {
        if (!next) await storage.removeItem(CLOUD_SESSION_KEY);
        else await storage.setItem(CLOUD_SESSION_KEY, JSON.stringify(next));
      },
    });
    await auth.hydrate();
    const original = globalThis.fetch;
    let startedFetch = false;
    let stopFetch = () => {};
    globalThis.fetch = () => {
      startedFetch = true;
      return new Promise((_resolve, reject) => {
        stopFetch = () => reject(new Error('aborted'));
      });
    };
    try {
      const started = Date.now();
      await auth.signOut();
      assert.ok(Date.now() - started < 500);
      assert.equal(auth.token(), null);
      assert.equal(await auth.getUser(), null);
      assert.equal(await storage.getItem(CLOUD_SESSION_KEY), null);
      assert.equal(auth.configured, true);
      assert.equal(process.env.EXPO_PUBLIC_SUPABASE_URL, 'https://example.supabase.co');
      assert.equal(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'public-anon');
      await new Promise((resolve) => setTimeout(resolve, 20));
      assert.equal(startedFetch, true);
    } finally {
      stopFetch();
      await Promise.resolve();
      globalThis.fetch = original;
      if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
      if (previousAnon === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    }
  });

  it('still signs out when auth.signOut never resolves, and keeps the account data parked', async () => {
    const storage = new MemoryKeyValueStorage();
    let user: CloudUser | null = null;
    let releaseHang = () => {};
    let stillHanging = false;
    const auth: CloudAuth = {
      configured: true,
      async getUser() {
        return user;
      },
      async signUp(email) {
        user = { id: 'alice', email };
        return { ok: true, user };
      },
      async signIn() {
        return { ok: false, error: 'invalid_credentials' };
      },
      async signOut() {
        user = null;
        stillHanging = true;
        await new Promise<void>((resolve) => {
          releaseHang = resolve;
        });
        stillHanging = false;
      },
      async resendSignupConfirmation() {
        return { ok: true };
      },
      async recoverPassword() {
        return { ok: true };
      },
    };
    const remote = {
      async listDocuments() {
        return [];
      },
      async upsertDocument() {},
    };
    const engine = new CloudSyncEngine(storage, auth, remote);
    const created = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(created.ok, true);
    const pgn = repertoire('alice-game', '1. e4 e5 *');
    const score = JSON.stringify({ bestByDifficulty: { facile: 7 } });
    await storage.setItem(StorageKeys.repertoires.key, pgn);
    await storage.setItem(StorageKeys.openingQuizRecords.key, score);
    const started = Date.now();
    const result = await engine.signOut();
    releaseHang();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(stillHanging, false);
    assert.ok(Date.now() - started < 1200);
    assert.equal(result.ok, true);
    assert.equal(engine.getState().user, null);
    assert.equal(engine.getState().sessionReady, true);
    assert.equal(engine.getState().status, 'signed_out');
    const parked = await storage.getItem(cloudWorkspaceKey('alice'));
    assert.match(parked ?? '', /alice-game/);
    assert.match(parked ?? '', /facile/);
    assert.equal((await storage.getItem(StorageKeys.repertoires.key) ?? '').includes('alice-game'), false);
  });

  it('does not send the signed-out PGN or scores to the next account', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new (await import('../MemoryCloud.ts')).MemoryCloudAuth();
    const inner = new (await import('../MemoryCloud.ts')).MemoryCloudRemote();
    const uploads: { userId: string; payload: string | null }[] = [];
    let blockAlice = false;
    let aliceId = '';
    let release = () => {};
    let listed = false;
    const remote = {
      async listDocuments(userId: string) {
        if (blockAlice && userId === aliceId) {
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
    await storage.setItem(StorageKeys.repertoires.key, repertoire('guest-game', '1. d4 *'));
    const created = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    aliceId = created.user.id;
    const alicePgn = repertoire('alice-game', '1. e4 e5 *');
    const aliceScore = JSON.stringify({ bestByDifficulty: { facile: 9 } });
    await storage.setItem(StorageKeys.repertoires.key, alicePgn);
    await storage.setItem(StorageKeys.openingQuizRecords.key, aliceScore);
    blockAlice = true;
    const pending = engine.sync();
    await waitFor(() => listed);
    const signedOut = await engine.signOut();
    assert.equal(signedOut.ok, true);
    assert.equal(engine.getState().user, null);
    assert.match((await storage.getItem(cloudWorkspaceKey(created.user.id))) ?? '', /alice-game/);
    assert.match((await storage.getItem(cloudWorkspaceKey(created.user.id))) ?? '', /facile/);
    release();
    await pending;
    blockAlice = false;
    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    const bobLocal = `${await storage.getItem(StorageKeys.repertoires.key) ?? ''}${await storage.getItem(StorageKeys.openingQuizRecords.key) ?? ''}`;
    assert.equal(bobLocal.includes('alice-game'), false);
    assert.equal(bobLocal.includes('facile'), false);
    assert.equal(
      uploads.some((item) => item.userId === bob.user.id && (item.payload ?? '').includes('alice-game')),
      false,
    );
    assert.equal(
      uploads.some((item) => item.userId === bob.user.id && (item.payload ?? '').includes('facile')),
      false,
    );
    assert.equal(uploads.some((item) => (item.payload ?? '').includes('alice-game')), false);
    await engine.signOut();
    await engine.signIn('alice@example.com', 'secret1');
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /alice-game/);
    assert.match((await storage.getItem(StorageKeys.openingQuizRecords.key)) ?? '', /facile/);
  });

  it('keeps the session and shows a failure when parking the local data throws', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new (await import('../MemoryCloud.ts')).MemoryCloudAuth();
    const remote = new (await import('../MemoryCloud.ts')).MemoryCloudRemote();
    let failPark = false;
    const guarded = {
      async getItem(key: string) {
        return storage.getItem(key);
      },
      async setItem(key: string, value: string) {
        if (failPark && key.includes('.workspace.')) throw new Error('disk full');
        await storage.setItem(key, value);
      },
      async removeItem(key: string) {
        await storage.removeItem(key);
      },
    };
    const engine = new CloudSyncEngine(guarded, auth, remote);
    await storage.setItem(StorageKeys.repertoires.key, repertoire('keep-game', '1. e4 *'));
    const created = await engine.signUp('ada@example.com', 'secret1');
    assert.equal(created.ok, true);
    if (!created.ok) return;
    await storage.setItem(StorageKeys.repertoires.key, repertoire('keep-game', '1. e4 e5 *'));
    failPark = true;
    const result = await engine.signOut();
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, 'unexpected');
    assert.equal(engine.getState().user?.id, created.user.id);
    assert.equal(engine.getState().sessionReady, true);
    assert.equal(engine.getState().lastError, 'local_quota');
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /1\. e4 e5/);
  });
});
