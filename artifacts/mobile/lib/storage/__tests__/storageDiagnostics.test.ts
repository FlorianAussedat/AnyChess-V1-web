import assert from 'node:assert/strict';
import { it } from 'node:test';
import { AsyncKeyValueStorage } from '../AsyncKeyValueStorage.ts';
import { MemoryKeyValueStorage } from '../KeyValueStorage.ts';
import { inspectStorage } from '../storageDiagnostics.ts';
import {
  CLOUD_SESSION_KEY,
  cloudWorkspaceKey,
  SYNCABLE_STORAGE_KEYS,
} from '../../cloud/syncableKeys.ts';
it('measures categories, backups, blocks and candidates without writes or exposing personal identifiers', async () => {
  class Counting extends MemoryKeyValueStorage {
    writes = 0;
    blockSecrets = false;
    override async setItem(k: string, v: string) {
      this.writes++;
      await super.setItem(k, v);
    }
    override async getItem(k: string) {
      if (this.blockSecrets && k === CLOUD_SESSION_KEY)
        assert.fail('diagnostic must not read session secrets');
      return super.getItem(k);
    }
  }
  const raw = new Counting(),
    storage = new AsyncKeyValueStorage(raw),
    privateId = 'PRIVATE_OWNER_ABC';
  await storage.setItem(SYNCABLE_STORAGE_KEYS[0], 'PRIVATE_PGN_CONTENT');
  await storage.setItem(cloudWorkspaceKey(privateId), 'X'.repeat(200000));
  await storage.setItem('anychess.cloud.backup.test.v1', 'Y'.repeat(200000));
  await raw.setItem(`${cloudWorkspaceKey(privateId)}.chunks.ambiguous-old.0`, 'POTENTIAL_RECOVERY');
  await raw.setItem(CLOUD_SESSION_KEY, 'PRIVATE_TOKEN');
  raw.blockSecrets = true;
  const writes = raw.writes,
    keys = await raw.getAllKeys();
  const report = await storage.diagnoseStorage();
  assert.equal(raw.writes, writes);
  assert.deepEqual(await raw.getAllKeys(), keys);
  assert.equal(report.categories.length, 18);
  assert.equal(report.snapshots.backups, 1);
  assert.equal(report.snapshots.workspaces, 1);
  assert.ok(report.blocks.referencedCount > 0);
  assert.equal(report.blocks.unreferencedCandidateCount, 1);
  assert.equal(report.cleanupAllowed, false);
  assert.equal(report.blocks.proofOfDisposableBlocks, false);
  assert.equal(report.categories[0].bytes, 19);
  assert.doesNotMatch(
    JSON.stringify(report),
    /PRIVATE_OWNER|PRIVATE_PGN|POTENTIAL_RECOVERY|ambiguous-old/,
  );
});
it('returns a partial audit for unreadable rows and invalid roots instead of suggesting deletion', async () => {
  class Broken extends MemoryKeyValueStorage {
    fail = false;
    override async getItem(k: string) {
      if (this.fail && k === SYNCABLE_STORAGE_KEYS[0]) throw new Error('CursorWindow PRIVATE');
      return super.getItem(k);
    }
  }
  const raw = new Broken();
  await raw.setItem(SYNCABLE_STORAGE_KEYS[0], 'retained');
  await raw.setItem(cloudWorkspaceKey('PRIVATE'), '@anychess/snapshot-chunks/1:{"count":99}');
  raw.fail = true;
  const report = await inspectStorage(raw);
  assert.equal(report.unreadableRows, 1);
  assert.equal(report.categories[0].unreadable, true);
  assert.equal(report.snapshots.invalidOrUnreadableRoots, 1);
  assert.equal(report.blocks.referencesComplete, false);
  assert.equal(report.cleanupAllowed, false);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE|CursorWindow/);
});
it('marks concurrent mutation as incomplete and never authorizes a cleanup', async () => {
  const raw = new MemoryKeyValueStorage();
  const report = await inspectStorage(raw, () => false);
  assert.equal(report.blocks.referencesComplete, false);
  assert.equal(report.cleanupAllowed, false);
});

it('reports the refused snapshot size for serialized backup creation without logging its contents', async () => {
  class Full extends MemoryKeyValueStorage {
    override async setItem(key: string, value: string) {
      if (key.includes('.chunks.')) throw new Error('SQLITE_FULL PRIVATE_ERROR');
      await super.setItem(key, value);
    }
  }
  const storage = new AsyncKeyValueStorage(new Full()),
    oldWarn = console.warn,
    oldDev = (globalThis as any).__DEV__,
    logs: unknown[] = [];
  (globalThis as any).__DEV__ = true;
  console.warn = (...args: unknown[]) => {
    logs.push(args);
  };
  try {
    await assert.rejects(
      () =>
        storage.updateItem('anychess.cloud.backup.PRIVATE_OWNER.v1', () =>
          'PRIVATE_PGN'.repeat(20000),
        ),
      /local_quota/,
    );
  } finally {
    console.warn = oldWarn;
    (globalThis as any).__DEV__ = oldDev;
  }
  const text = JSON.stringify(logs);
  assert.match(text, /requestedKiB/);
  assert.match(text, /storage.snapshot.refused/);
  assert.doesNotMatch(text, /PRIVATE_OWNER|PRIVATE_PGN|PRIVATE_ERROR/);
});
