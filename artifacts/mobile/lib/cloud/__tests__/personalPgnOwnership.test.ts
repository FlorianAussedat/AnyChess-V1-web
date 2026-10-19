/**
 * Personal opening PGNs belong to one account.
 * A fresh install and guest mode expose none. Guest copies stay until Supabase
 * has confirmed an explicit import.
 */
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../MemoryCloud.ts';
import {
  GUEST_PGN_VAULT_KEY,
  PGN_PRESENCE_AUDIT_KEY,
  repertoireFileIds,
} from '../guestPgnVault.ts';
import { cloudWorkspaceKey } from '../syncableKeys.ts';
import type { CloudDocument, CloudRemote } from '../types.ts';
import { RepertoireService } from '../../repertoire/RepertoireService.ts';
import {
  installPersonalPgnGuard,
  PersonalPgnAccessError,
} from '../../repertoire/personalPgnAccess.ts';
import type { RepertoireStorage } from '../../repertoire/storage/RepertoireStorage.ts';
import { emptyRepertoireStore, type RepertoireStoreSnapshot } from '../../repertoire/storage/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../../');

function repertoire(id: string, pgnText: string) {
  return JSON.stringify({
    version: 2,
    folders: [{ id: 'folder-1', name: 'Italienne', side: 'white', parentId: null }],
    files: [{ id, filename: `${id}.pgn`, pgnText, folderId: 'folder-1' }],
  });
}

function memoryStorage(): RepertoireStorage {
  let snap = emptyRepertoireStore();
  return {
    async load() {
      return structuredClone(snap);
    },
    async save(next: RepertoireStoreSnapshot) {
      snap = structuredClone(next);
    },
    async clear() {
      snap = emptyRepertoireStore();
    },
  };
}

class UnreachableRemote implements CloudRemote {
  async listDocuments(): Promise<CloudDocument[]> {
    throw new Error('offline');
  }

  async upsertDocument(): Promise<void> {
    throw new Error('offline');
  }
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, out);
    else if (name.endsWith('.pgn')) out.push(full);
  }
}

describe('personal PGN ownership', () => {
  it('ships no personal PGN in the app and creates none on a fresh install', async () => {
    const bundled: string[] = [];
    walk(repoRoot, bundled);
    assert.deepEqual(bundled, []);

    const storage = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), new MemoryCloudRemote());
    const state = await engine.hydrate();
    assert.equal(state.user, null);
    assert.equal(await storage.getItem(StorageKeys.repertoires.key), null);
    assert.equal(repertoireFileIds(await storage.getItem(GUEST_PGN_VAULT_KEY)).length, 0);
  });

  it('hides existing guest studies without deleting them', async () => {
    const storage = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(storage, new MemoryCloudAuth(), new MemoryCloudRemote());
    await storage.setItem(StorageKeys.repertoires.key, repertoire('guest-file', '1. a3 *'));
    await engine.hydrate();
    assert.equal(repertoireFileIds(await storage.getItem(StorageKeys.repertoires.key)).includes('guest-file'), false);
    assert.match((await storage.getItem(GUEST_PGN_VAULT_KEY)) ?? '', /guest-file/);
    assert.equal(await engine.guestDataAvailable(), true);
  });

  it('keeps each account cache private, including after sign-out and while offline', async () => {
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

    const live = await storage.getItem(StorageKeys.repertoires.key);
    assert.equal(repertoireFileIds(live).includes('alice-file'), false);
    assert.doesNotMatch((await storage.getItem(GUEST_PGN_VAULT_KEY)) ?? '', /alice-file/);
    assert.doesNotMatch((await storage.getItem(cloudWorkspaceKey('guest'))) ?? '', /alice-file/);
    assert.match((await storage.getItem(cloudWorkspaceKey(alice.user.id))) ?? '', /alice-file/);

    const bob = await engine.signUp('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    if (!bob.ok) return;
    assert.doesNotMatch((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /alice-file/);
    assert.equal(
      remote.peek(bob.user.id, StorageKeys.repertoires.key)?.payload?.includes('alice-file') ?? false,
      false,
    );
    await engine.signOut();
    const aliceAgain = await engine.signIn('alice@example.com', 'secret1');
    assert.equal(aliceAgain.ok, true);
    assert.match((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /alice-file/);
    assert.doesNotMatch((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /bob-file/);
  });

  it('restores synced studies on a new install of the same account', async () => {
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const phone = new MemoryKeyValueStorage();
    const engine = new CloudSyncEngine(phone, auth, remote);
    await engine.signUp('alice@example.com', 'secret1');
    await phone.setItem(StorageKeys.repertoires.key, repertoire('alice-file', '1. e4 e5 *'));
    await engine.sync();

    const reinstall = new MemoryKeyValueStorage();
    const next = new CloudSyncEngine(reinstall, auth, remote);
    const signed = await next.signIn('alice@example.com', 'secret1');
    assert.equal(signed.ok, true);
    assert.match((await reinstall.getItem(StorageKeys.repertoires.key)) ?? '', /alice-file/);
    assert.match((await reinstall.getItem(StorageKeys.repertoires.key)) ?? '', /1\. e4 e5/);
  });

  it('copies guest studies only after Supabase lists them, and keeps the device copy', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const engine = new CloudSyncEngine(storage, auth, remote);
    await storage.setItem(StorageKeys.repertoires.key, repertoire('guest-file', '1. a3 *'));
    await engine.hydrate();
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    if (!alice.ok) return;
    assert.doesNotMatch((await storage.getItem(StorageKeys.repertoires.key)) ?? '', /guest-file/);
    assert.equal(remote.peek(alice.user.id, StorageKeys.repertoires.key)?.payload?.includes('guest-file') ?? false, false);

    const imported = await engine.importGuestData();
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.remoteVerified, true);
    assert.match(remote.peek(alice.user.id, StorageKeys.repertoires.key)?.payload ?? '', /guest-file/);
    assert.match((await storage.getItem(GUEST_PGN_VAULT_KEY)) ?? '', /guest-file/);
    const audit = JSON.parse((await storage.getItem(PGN_PRESENCE_AUDIT_KEY)) ?? '{}') as {
      remoteReachable: boolean;
      remoteVerified: boolean;
      vaultFileIds: string[];
    };
    assert.equal(audit.remoteReachable, true);
    assert.equal(audit.remoteVerified, true);
    assert.ok(audit.vaultFileIds.includes('guest-file'));
  });

  it('does not migrate or delete guest studies when Supabase cannot be read', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const engine = new CloudSyncEngine(storage, auth, new UnreachableRemote());
    await storage.setItem(StorageKeys.repertoires.key, repertoire('guest-file', '1. a3 *'));
    await engine.hydrate();
    const alice = await engine.signUp('alice@example.com', 'secret1');
    assert.equal(alice.ok, true);
    const before = await storage.getItem(GUEST_PGN_VAULT_KEY);
    const imported = await engine.importGuestData();
    assert.deepEqual(imported, { ok: false, error: 'remote_unverified' });
    assert.equal(await storage.getItem(GUEST_PGN_VAULT_KEY), before);
    assert.match(before ?? '', /guest-file/);
    const audit = JSON.parse((await storage.getItem(PGN_PRESENCE_AUDIT_KEY)) ?? '{}') as {
      remoteReachable: boolean;
    };
    assert.equal(audit.remoteReachable, false);
  });

  it('does not write studies that were read before the cache was discarded', async () => {
    let releaseLoad: (snap: RepertoireStoreSnapshot) => void = () => undefined;
    const firstLoad = new Promise<RepertoireStoreSnapshot>((resolve) => {
      releaseLoad = resolve;
    });
    const stale = emptyRepertoireStore();
    stale.files.push({
      id: 'guest-file',
      folderId: 'folder-1',
      filename: 'guest.pgn',
      importedAt: '2026-01-01T00:00:00.000Z',
      pgnText: '1. a3 *',
      summary: {
        gameCount: 1,
        positionCount: 1,
        branchCount: 0,
        parseSucceeded: true,
        errors: [],
        warnings: [],
      },
    });
    let phase: 'stale' | 'current' = 'stale';
    const savedIds: string[][] = [];
    const storage: RepertoireStorage = {
      async load() {
        return phase === 'stale' ? firstLoad : emptyRepertoireStore();
      },
      async save(next) {
        savedIds.push(next.files.map((file) => file.id));
      },
      async clear() {},
    };
    const svc = new RepertoireService(storage);
    const pending = svc.ensureLoaded();
    phase = 'current';
    svc.discardCachedSnapshot();
    releaseLoad(stale);
    await pending;
    assert.equal(savedIds.some((ids) => ids.includes('guest-file')), false);
  });

  it('refuses to save a personal PGN when the account guard is installed', async () => {
    installPersonalPgnGuard(() => {
      throw new PersonalPgnAccessError('account required');
    });
    try {
      const svc = new RepertoireService(memoryStorage());
      await assert.rejects(() => svc.importPgn('folder', 'a.pgn', '1. e4 *'), PersonalPgnAccessError);
      await assert.rejects(() => svc.createFolder('Italienne', 'white'), PersonalPgnAccessError);
    } finally {
      installPersonalPgnGuard(null);
    }
  });
});
