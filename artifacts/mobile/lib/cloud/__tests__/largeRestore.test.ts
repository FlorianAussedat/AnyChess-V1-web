import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';
import { AsyncKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import { CloudSyncEngine, restoreBackup } from '../CloudSyncEngine.ts';
import { MemoryCloudAuth } from '../MemoryCloud.ts';
import type { CloudDocument, CloudRemote } from '../types.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { SYNCABLE_STORAGE_KEYS } from '../syncableKeys.ts';
import { setCloudTransferReadersForTests } from '../syncTransport.ts';
import { Chess } from 'chess.js';
import { GameLibraryStore } from '../../gameLibrary/GameLibraryStore.ts';
import { PgnCommentTranslationStore } from '../../pgnComments/PgnCommentTranslationStore.ts';
import { commentAnchorKey } from '../../pgnComments/collectComments.ts';
import { fingerprintComment } from '../../pgnComments/fingerprint.ts';
import { readBackupIndex } from '../backupIndex.ts';
import { AsyncStorageRepertoireStorage } from '../../repertoire/storage/AsyncStorageRepertoireStorage.ts';

export class AndroidQuotaRows {
  values = new Map<string, string>();
  limit = 6 * 1024 * 1024;
  writes = 0;
  refused: { bytes: number; total: number; category: string }[] = [];
  failAfter = Infinity;
  used() {
    return [...this.values.values()].reduce(
      (n, v) => n + Buffer.byteLength(v),
      0,
    );
  }
  async getItem(key: string) {
    const raw = this.values.get(key) ?? null;
    if (raw && Buffer.byteLength(raw) > 2 * 1024 * 1024)
      throw new Error('CursorWindow row too big');
    return raw;
  }
  async setItem(key: string, value: string) {
    this.writes++;
    const total =
      this.used() -
      Buffer.byteLength(this.values.get(key) ?? '') +
      Buffer.byteLength(value);
    if (--this.failAfter === 0 || total > this.limit) {
      this.refused.push({
        bytes: Buffer.byteLength(value),
        total,
        category: SYNCABLE_STORAGE_KEYS.includes(key as any)
          ? String(SYNCABLE_STORAGE_KEYS.indexOf(key as any))
          : 'recovery',
      });
      throw new Error('SQLITE_FULL fixture');
    }
    this.values.set(key, value);
  }
  async removeItem(key: string) {
    this.values.delete(key);
  }
  async getAllKeys() {
    return [...this.values.keys()];
  }
}
const engines = new Set<CloudSyncEngine>();
afterEach(() => {
  for (const e of engines) e.dispose();
  engines.clear();
  setCloudTransferReadersForTests({ transport: null });
});
function comment(length: number) {
  let seed = 12345,
    text = '';
  const words = [
    'opening',
    'white',
    'black',
    'centre',
    'variation',
    'position',
    'pawn',
    'bishop',
    'knight',
    'queen',
    'castle',
    'defence',
    'attack',
    'space',
    'tempo',
    'endgame',
  ];
  while (text.length < length) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    text += words[(seed >>> 16) % words.length] + ' ';
  }
  return text.slice(0, length);
}
function documents() {
  const docs = new Map<string, CloudDocument>();
  const add = (docKey: string, value: unknown) =>
    docs.set(docKey, {
      docKey,
      payload: JSON.stringify(value),
      revision: 4,
      updatedAt: '2026-01-01',
      deletedAt: null,
    });
  add(StorageKeys.repertoires.key, {
    version: 2,
    folders: [
      { id: 'root', name: 'Demo', side: 'white', parentId: null },
      { id: 'nested', name: 'Nested', side: 'white', parentId: 'root' },
    ],
    files: Array.from({ length: 14 }, (_, i) => ({
      id: `study-${i}`,
      filename: `demo-${i}.pgn`,
      folderId: 'nested',
      pgnText: `1. e4 {${i} ${comment(110000)}} (1. d4 d5) e5 $1 *`,
    })),
  });
  const game = new Chess(),
    initialFen = game.fen();
  game.move('e4');
  const firstFen = game.fen();
  game.move('e5');
  const finalFen = game.fen();
  add(StorageKeys.gameLibrary.key, {
    version: 2,
    folders: [
      { id: 'games', name: 'Demo', parentId: null, createdAt: 1, updatedAt: 1 },
    ],
    games: Array.from({ length: 6 }, (_, i) => ({
      id: `game-${i}`,
      fingerprint: `fixture-game-${i}`,
      folderId: 'games',
      headers: { white: 'Demo A', black: 'Demo B', result: '*' },
      initialFen,
      hasVariations: false,
      source: {
        fileName: `analysis-${i}.pgn`,
        importedAt: 1,
        rawPgn: `1. e4 {${comment(65000)}} e5 *`,
      },
      moves: [
        { ply: 1, san: 'e4', fenAfter: firstFen },
        { ply: 2, san: 'e5', fenAfter: finalFen },
      ],
    })),
  });
  add(StorageKeys.pgnCommentTranslations.key, {
    version: 1,
    records: Object.fromEntries(
      Array.from({ length: 120 }, (_, i) => {
        const anchor = {
          source: 'repertoire' as const,
          fileId: `study-${i % 14}`,
          gameIndex: 0,
          nodeId: `node-${i}`,
          slot: 'after' as const,
        };
        const originalText = comment(23000),
          translatedText = comment(23000)
            .replace(/white/g, 'blanc')
            .replace(/black/g, 'noir');
        return [
          commentAnchorKey(anchor),
          {
            id: `translation-${i}`,
            anchor,
            sourceLang: 'en',
            targetLang: 'fr',
            originalFingerprint: fingerprintComment(originalText),
            originalText,
            translatedText,
            status: 'ready',
            method: 'automatic',
            updatedAt: '2026-01-01',
          },
        ];
      }),
    ),
  });
  for (const key of SYNCABLE_STORAGE_KEYS.slice(3, 15))
    add(
      key,
      key === StorageKeys.userProfile.key
        ? { username: 'Demo', updatedAt: '2026-01-01' }
        : {},
    );
  return docs;
}
async function phone(raw = new AndroidQuotaRows(), rows = documents()) {
  setCloudTransferReadersForTests({ transport: async () => 'wifi' });
  const auth = new MemoryCloudAuth();
  auth.seed('demo@example.com', 'secret1', 'owner');
  const remote: CloudRemote = {
    async listDocuments() {
      return structuredClone([...rows.values()]);
    },
    async upsertDocument(_owner, doc) {
      const prior = rows.get(doc.docKey);
      assert.equal(doc.revision, (prior?.revision ?? 0) + 1);
      rows.set(doc.docKey, structuredClone(doc));
    },
  };
  const storage = new AsyncKeyValueStorage(raw),
    engine = new CloudSyncEngine(storage, auth, remote);
  engines.add(engine);
  return { raw, rows, storage, engine, auth, remote };
}
it('restores 14 opening PGNs, 6 analyses and large translations on a fresh 6 MiB Android store', async () => {
  const p = await phone();
  const rawTotal = [...p.rows.values()].reduce(
    (n, d) => n + Buffer.byteLength(d.payload ?? ''),
    0,
  );
  assert.ok(rawTotal > 6 * 1024 * 1024);
  assert.equal((await p.engine.signIn('demo@example.com', 'secret1')).ok, true);
  await p.engine.sync();
  assert.equal(
    p.engine.getState().status,
    'synced',
    JSON.stringify({
      state: p.engine.getState().lastError,
      refused: p.raw.refused,
      used: p.raw.used(),
    }),
  );
  const openings = await new AsyncStorageRepertoireStorage(p.storage).load();
  assert.equal(openings.files.length, 14);
  assert.ok(openings.folders.some((f) => f.id === 'nested'));
  assert.equal(
    JSON.parse((await p.storage.getItem(StorageKeys.gameLibrary.key))!).games
      .length,
    6,
  );
  assert.equal(
    Object.keys(
      JSON.parse(
        (await p.storage.getItem(StorageKeys.pgnCommentTranslations.key))!,
      ).records,
    ).length,
    120,
  );
  assert.equal(
    (await new GameLibraryStore(p.storage).getSnapshot()).games.length,
    6,
  );
  const translations = await new PgnCommentTranslationStore(
    p.storage,
  ).ensureLoaded();
  assert.equal(Object.keys(translations.records).length, 120);
  assert.equal(Object.values(translations.records)[0].status, 'ready');
  assert.equal(p.raw.refused.length, 0);
});

it('round-trips offline editing, network return, repeat sync and application restart without copying the large translations into every backup', async () => {
  const p = await phone();
  await p.engine.signIn('demo@example.com', 'secret1');
  await p.engine.sync();
  const before = p.raw.used(),
    saved = await p.engine.backupLocal(false);
  const report = await p.storage.diagnoseStorage();
  console.info(
    'large-restore fixture bytes',
    JSON.stringify({
      physical: p.raw.used(),
      logical: report.categories.map((c) => ({
        category: c.category,
        bytes: c.bytes,
      })),
      backups: report.snapshots.backups,
    }),
  );
  const copy = JSON.parse((await p.storage.getItem(saved))!);
  assert.equal(Object.keys(copy.docs).length, 18);
  const afterBackup = p.raw.used();
  assert.ok(afterBackup - before < 15000);
  setCloudTransferReadersForTests({ transport: async () => 'offline' });
  const opening = JSON.parse(
    (await p.storage.getItem(StorageKeys.repertoires.key))!,
  );
  opening.files[0].pgnText = opening.files[0].pgnText.replace(
    ' e5 $1 *',
    ' e5 {offline change} $1 *',
  );
  await p.storage.setItem(StorageKeys.repertoires.key, JSON.stringify(opening));
  await p.engine.sync();
  assert.equal(p.engine.getState().status, 'offline');
  p.engine.dispose();
  const restarted = new CloudSyncEngine(
    new AsyncKeyValueStorage(p.raw),
    p.auth,
    p.remote,
  );
  engines.add(restarted);
  await restarted.hydrate();
  assert.match(
    (await p.storage.getItem(StorageKeys.repertoires.key))!,
    /offline change/,
  );
  setCloudTransferReadersForTests({ transport: async () => 'cellular' });
  await restarted.sync();
  await restarted.sync();
  assert.equal(restarted.getState().status, 'synced');
  assert.match(
    p.rows.get(StorageKeys.repertoires.key)!.payload!,
    /offline change/,
  );
  const newBackup = await restarted.backupLocal(false);
  assert.notEqual(saved, newBackup);
  assert.equal(
    Object.keys(JSON.parse((await p.storage.getItem(newBackup))!).docs).length,
    18,
  );
  assert.doesNotMatch((await p.storage.getItem(saved))!, /offline change/);
  const stable = p.raw.used(),
    indexCount = (await readBackupIndex(p.storage)).length;
  for (let i = 0; i < 3; i++) {
    await restarted.sync();
    await restarted.backupLocal(false);
  }
  assert.equal(p.raw.used(), stable);
  assert.equal((await readBackupIndex(p.storage)).length, indexCount);
  assert.ok(
    p.raw.used() - afterBackup < 1100000,
    `changed chunks and roots must not recopy the 5.5 MB translations: ${p.raw.used() - afterBackup}`,
  );
  const afterReport = await p.storage.diagnoseStorage();
  assert.equal(
    afterReport.categories[2].physicalBytes,
    report.categories[2].physicalBytes,
  );
  assert.equal(afterReport.categories[2].bytes, report.categories[2].bytes);
  restarted.dispose();
  const reopened = new CloudSyncEngine(
    new AsyncKeyValueStorage(p.raw),
    p.auth,
    p.remote,
  );
  engines.add(reopened);
  await reopened.hydrate();
  assert.equal(reopened.getState().status, 'synced');
  const openings = await new AsyncStorageRepertoireStorage(
    new AsyncKeyValueStorage(p.raw),
  ).load();
  assert.ok(openings.files.some((f) => f.pgnText?.includes('offline change')));
  assert.ok(
    openings.files.filter((f) => !f.id.includes('~recovery-')).length === 14,
  );
});
it('keeps the old active document and every incomplete block after interruption, then resumes on restart', async () => {
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = StorageKeys.repertoires.key;
  await storage.setItem(key, '{"before":true}');
  raw.failAfter = 3;
  const next = JSON.stringify({ text: comment(290000) });
  await assert.rejects(() => storage.setItem(key, next), /local_quota/);
  assert.equal(await storage.getItem(key), '{"before":true}');
  const parts = [...raw.values.keys()].filter((k) => k.includes('.chunks.'));
  assert.ok(parts.length > 0);
  raw.failAfter = Infinity;
  const restarted = new AsyncKeyValueStorage(raw);
  await restarted.setItem(key, next);
  assert.equal(await restarted.getItem(key), next);
  for (const part of parts) assert.ok(raw.values.has(part));
  const writes = raw.writes;
  await restarted.setItem(key, next);
  assert.equal(raw.writes, writes);
});
it('reports quota and stops automatic retries when even compressed unique data cannot fit', async () => {
  const p = await phone();
  p.raw.limit = 700;
  await p.auth.signIn('demo@example.com', 'secret1');
  await p.engine.hydrate();
  assert.equal(p.engine.getState().user?.id, 'owner');
  assert.equal(p.engine.getState().lastError, 'local_quota');
  const writes = p.raw.writes;
  await p.engine.sync({ automatic: true });
  assert.equal(p.raw.writes, writes);
  const diagnostic = await p.storage.diagnoseStorage();
  assert.equal(diagnostic.lastFailure?.kind, 'local_quota');
  assert.match(diagnostic.lastFailure!.stage, /storage\./);
  assert.ok(diagnostic.lastFailure!.requestedBytes > 0);
  p.raw.limit = 6 * 1024 * 1024;
  await p.engine.sync();
  await p.engine.sync();
  assert.equal(p.engine.getState().status, 'synced');
});
it('preserves a readable committed value when publication acknowledgement is ambiguous', async () => {
  class Ambiguous extends AndroidQuotaRows {
    once = false;
    override async setItem(k: string, v: string) {
      await super.setItem(k, v);
      if (this.once && k === StorageKeys.repertoires.key) {
        this.once = false;
        throw Error('SQLITE_FULL after acknowledgement lost');
      }
    }
  }
  const raw = new Ambiguous(),
    storage = new AsyncKeyValueStorage(raw),
    key = StorageKeys.repertoires.key;
  await storage.setItem(key, 'old');
  const next = JSON.stringify({ text: comment(170000) });
  raw.once = true;
  await assert.rejects(() => storage.setItem(key, next), /local_quota/);
  assert.equal(await new AsyncKeyValueStorage(raw).getItem(key), next);
  const bytes = raw.used();
  await storage.setItem(key, next);
  assert.equal(raw.used(), bytes);
});
it('rejects corrupted shared blocks without replacing documents or deleting backups', async () => {
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = StorageKeys.repertoires.key;
  await storage.setItem(key, JSON.stringify({ text: comment(200000) }));
  const root = raw.values.get(key),
    block = [...raw.values.keys()].find((k) =>
      k.startsWith('anychess.storage.pool.'),
    )!;
  raw.values.set(block, '@deflate/1:not-base64');
  await assert.rejects(() => storage.getItem(key), /local_storage/);
  assert.equal(raw.values.get(key), root);
  assert.ok(raw.values.has(block));
  const report = await storage.diagnoseStorage();
  assert.equal(report.blocks.referencesComplete, false);
  assert.ok(report.snapshots.invalidOrUnreadableRoots > 0);
});
it('preserves byte-exact legacy/whitespace envelopes and does not rewrite anything at startup', async () => {
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = 'anychess.cloud.workspace.legacy.v1';
  const text = JSON.stringify(
    {
      ownerId: 'legacy',
      docs: { [StorageKeys.repertoires.key]: comment(160000) },
      parkedAt: '2026-01-01',
    },
    null,
    2,
  );
  raw.values.set(key, text);
  assert.equal(await storage.getItem(key), text);
  assert.equal(raw.writes, 0);
  await storage.setItem(key, text);
  assert.equal(raw.writes, 0);
  await storage.setItem(key, text + '\n');
  assert.equal(await storage.getItem(key), text + '\n');
  const unusual=JSON.stringify({ownerId:'legacy',docs:Object.fromEntries([['__proto__',comment(8000)]])});
  await storage.setItem(key,unusual);assert.equal(await storage.getItem(key),unusual);
});
it('keeps two accounts and the guest workspace isolated with shared physical blocks', async () => {
  const p = await phone();
  p.auth.seed('other@example.com', 'secret1', 'other');
  const remote = p.remote;
  const scoped = {
    listDocuments: (owner: string) =>
      owner === 'owner' ? remote.listDocuments(owner) : Promise.resolve([]),
    upsertDocument: (owner: string, doc: CloudDocument) =>
      owner === 'owner' ? remote.upsertDocument(owner, doc) : Promise.resolve(),
  };
  const engine = new CloudSyncEngine(p.storage, p.auth, scoped);
  engines.add(engine);
  await engine.signIn('demo@example.com', 'secret1');
  await engine.sync();
  assert.equal((await engine.signOut()).ok, true);
  const guest = await p.storage.getItem('anychess.cloud.workspace.guest.v1');
  await engine.signIn('other@example.com', 'secret1');
  await engine.sync();
  assert.equal(await p.storage.getItem(StorageKeys.repertoires.key), null);
  assert.equal((await engine.signOut()).ok, true);
  assert.equal(
    await p.storage.getItem('anychess.cloud.workspace.guest.v1'),
    guest,
  );
  await engine.signIn('demo@example.com', 'secret1');
  await engine.sync();
  assert.equal(
    (await new AsyncStorageRepertoireStorage(p.storage).load()).files.length,
    14,
  );
});
it('deduplicates restoration recovery snapshots and proposes retention without deleting distinct copies', async () => {
  const { backupRetentionPlan } = await import('../verifiedBackup.ts');
  const p = await phone();
  await p.engine.signIn('demo@example.com', 'secret1');
  await p.engine.sync();
  const first = await p.engine.backupLocal(false),
    copy = (await p.storage.getItem(first))!;
  const duplicate = 'anychess.cloud.backup.duplicate.v1';
  await p.storage.setItem(duplicate, copy);
  const writes = p.raw.writes,
    plan = await backupRetentionPlan(p.storage, 'owner');
  assert.equal(p.raw.writes, writes);
  assert.ok(plan.identicalCopies >= 1);
  assert.equal(plan.deletionAuthorized, false);
  assert.equal(plan.target, 2);
  assert.equal(await restoreBackup(p.storage, first), true);
  const count = (await readBackupIndex(p.storage)).length;
  assert.equal(await restoreBackup(p.storage, first), true);
  assert.equal((await readBackupIndex(p.storage)).length, count);
  assert.equal(await p.storage.getItem(duplicate), copy);
  assert.equal(await p.storage.getItem(first), copy);
});

it('reuses and compacts a verified PR127 chunked backup while keeping an unrelated interrupted generation', async () => {
  const { writeSnapshot } = await import('../../storage/snapshotStorage.ts');
  const { verifiedBackup } = await import('../verifiedBackup.ts');
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = 'anychess.cloud.backup.legacy.v1';
  const docs = Object.fromEntries(
    SYNCABLE_STORAGE_KEYS.map((k) => [
      k,
      k === StorageKeys.repertoires.key
        ? JSON.stringify({ text: comment(1600000) })
        : null,
    ]),
  );
  const value = JSON.stringify({ version: 2, ownerId: 'owner', docs });
  await writeSnapshot(raw, key, value);
  const oldParts = [...raw.values.keys()].filter((k) =>
    k.startsWith(key + '.chunks.'),
  );
  const candidate = key + '.chunks.interrupted-old.0';
  await raw.setItem(candidate, 'UNCERTAIN_RECOVERY');
  await storage.setItem(
    StorageKeys.repertoires.key,
    docs[StorageKeys.repertoires.key]!,
  );
  const before = raw.used();
  assert.equal(await verifiedBackup(storage, 'owner', docs), key);
  assert.equal(await storage.getItem(key), value);
  assert.ok(raw.used() < before / 2);
  assert.ok(
    oldParts.every((k) => !raw.values.has(k)),
    'only verified superseded committed chunks may be reclaimed',
  );
  assert.equal(await raw.getItem(candidate), 'UNCERTAIN_RECOVERY');
});
it('keeps every legacy backup chunk if verified compaction is interrupted before publication', async () => {
  const { writeSnapshot } = await import('../../storage/snapshotStorage.ts');
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = 'anychess.cloud.backup.legacy-interruption.v1';
  const value = JSON.stringify({
    version: 2,
    ownerId: 'owner',
    docs: { [StorageKeys.repertoires.key]: comment(200000) },
  });
  await writeSnapshot(raw, key, value);
  const old = [...raw.values.keys()];
  raw.failAfter = 2;
  await assert.rejects(() => storage.compactItem(key), /local_quota/);
  for (const key of old) assert.ok(raw.values.has(key));
  assert.equal(await storage.getItem(key), value);
  raw.failAfter = Infinity;
  await new AsyncKeyValueStorage(raw).compactItem(key);
  assert.equal(await storage.getItem(key), value);
});
it('notifies the same account when opening PGNs became durable even if a later category fails', async () => {
  class Partial extends AndroidQuotaRows {
    failTranslations = true;
    override async setItem(k: string, v: string) {
      if (this.failTranslations && k === StorageKeys.pgnCommentTranslations.key)
        throw Error('SQLITE_FULL late category');
      await super.setItem(k, v);
    }
  }
  const raw = new Partial(),
    p = await phone(raw);
  let revisions: number[] = [];
  p.engine.subscribe(() => {
    revisions.push(p.engine.getState().libraryRevision ?? 0);
  });
  await p.auth.signIn('demo@example.com', 'secret1');
  await p.engine.hydrate();
  assert.equal(p.engine.getState().user?.id, 'owner');
  assert.equal(p.engine.getState().status, 'error');
  assert.ok(revisions.some((r) => r > 0));
  assert.equal(
    (await new AsyncStorageRepertoireStorage(p.storage).load()).files.length,
    14,
  );
  raw.failTranslations = false;
  await p.engine.sync();
  await p.engine.sync();
  assert.equal(p.engine.getState().status, 'synced');
});
it('preserves Unicode and literal codec prefixes across block boundaries', async () => {
  const raw = new AndroidQuotaRows(),
    storage = new AsyncKeyValueStorage(raw),
    key = StorageKeys.repertoires.key;
  for (const text of [
    'échec 中文 ♞ 👑'.repeat(15000),
    'x'.repeat(65536) + '@deflate/1:literal ' + comment(80000),
  ]) {
    await storage.setItem(key, text);
    assert.equal(await new AsyncKeyValueStorage(raw).getItem(key), text);
  }
});
