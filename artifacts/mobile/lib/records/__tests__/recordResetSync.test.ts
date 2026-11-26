import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { CloudSyncEngine } from '../../cloud/CloudSyncEngine.ts';
import { MemoryCloudAuth, MemoryCloudRemote } from '../../cloud/MemoryCloud.ts';
import { mergeDocumentPayload } from '../../cloud/mergeDocuments.ts';
import { setCloudTransferReadersForTests } from '../../cloud/syncTransport.ts';
import { cloudWorkspaceKey } from '../../cloud/syncableKeys.ts';
import { PlayMoveRecordsStore } from '../../playMove/PlayMoveRecords.ts';
import { mergeRecordDocument } from '../scoreDocument.ts';

const PLAY = StorageKeys.playMoveSession60.key;
const PGN = StorageKeys.repertoires.key;

function highScore(best: number, at: string) {
  return JSON.stringify({ best, scoredAt: { best: at }, updatedAt: at });
}

function resetScore(at: string) {
  return JSON.stringify({
    best: 0,
    resetAt: at,
    scoredAt: { best: at },
    updatedAt: at,
  });
}

describe('record reset survives sync', () => {
  after(() => {
    setCloudTransferReadersForTests({ transport: null, wifiOnly: null });
  });

  it('lets a reset beat an older cloud score and leaves PGNs alone', () => {
    const pgn = JSON.stringify({ version: 2, files: [{ id: 'a', pgnText: '1. e4 *' }] });
    const merged = mergeDocumentPayload(PLAY, resetScore('2026-10-02T00:00:00.000Z'), highScore(40, '2026-10-01T00:00:00.000Z'));
    const doc = JSON.parse(merged ?? '{}') as { best: number };
    assert.equal(doc.best, 0);
    assert.equal(mergeDocumentPayload(PGN, pgn, pgn), pgn);
    const kept = mergeRecordDocument(
      JSON.parse(highScore(9, '2026-10-03T00:00:00.000Z')),
      JSON.parse(resetScore('2026-10-02T00:00:00.000Z')),
    ) as { best: number };
    assert.equal(kept.best, 9);
  });

  it('pushes a reset and keeps a score earned afterwards', async () => {
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    auth.seed('ada@example.com', 'secret1');
    const engine = new CloudSyncEngine(storage, auth, remote);
    const signed = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, true);
    const userId = signed.ok ? signed.user.id : '';
    await storage.setItem(PLAY, highScore(40, '2026-10-01T00:00:00.000Z'));
    await storage.setItem(PGN, JSON.stringify({ version: 2, files: [{ id: 'keep' }] }));
    await engine.sync();
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 40);

    const records = new PlayMoveRecordsStore(storage);
    await records.reset('2026-10-02T00:00:00.000Z');
    assert.notEqual(await storage.getItem(PLAY), null);
    await engine.sync();
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 0);
    assert.match(remote.peek(userId, PLAY)?.payload ?? '', /2026-10-02/);
    assert.match((await storage.getItem(PGN)) ?? '', /keep/);

    const again = await records.saveScore(7);
    assert.equal(again, 7);
    await engine.sync();
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 7);
  });

  it('does not restore a cloud score when the reset happens during the upload', async () => {
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    const original = remote.upsertDocument.bind(remote);
    let arm = false;
    remote.upsertDocument = async (userId, doc) => {
      if (arm && doc.docKey === PLAY) {
        arm = false;
        await storage.setItem(PLAY, resetScore('2026-10-04T00:00:00.000Z'));
      }
      await original(userId, doc);
    };
    auth.seed('ada@example.com', 'secret1');
    const engine = new CloudSyncEngine(storage, auth, remote);
    const signed = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, true);
    const userId = signed.ok ? signed.user.id : '';
    await storage.setItem(PLAY, highScore(40, '2026-10-01T00:00:00.000Z'));
    await engine.sync();
    arm = true;
    await storage.setItem(PLAY, highScore(41, '2026-10-01T00:00:00.000Z'));
    await engine.sync();
    const local = JSON.parse((await storage.getItem(PLAY)) ?? '{}') as { best: number; resetAt?: string };
    assert.equal(local.best, 0);
    assert.equal(local.resetAt, '2026-10-04T00:00:00.000Z');
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 0);
  });

  it('keeps an offline reset until the network returns, including after a restart', async () => {
    let online = false;
    setCloudTransferReadersForTests({
      transport: async () => (online ? 'wifi' : 'offline'),
      wifiOnly: async () => false,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    auth.seed('ada@example.com', 'secret1');
    const engine = new CloudSyncEngine(storage, auth, remote);
    online = true;
    const signed = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, true);
    const userId = signed.ok ? signed.user.id : '';
    await storage.setItem(PLAY, highScore(12, '2026-10-01T00:00:00.000Z'));
    await engine.sync();
    online = false;
    const records = new PlayMoveRecordsStore(storage);
    await records.reset('2026-10-05T00:00:00.000Z');
    const offline = await engine.sync();
    assert.equal(offline.status, 'offline');
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 12);
    assert.equal(JSON.parse((await storage.getItem(PLAY)) ?? '{}').best, 0);

    const restarted = new CloudSyncEngine(storage, auth, remote);
    await restarted.signIn('ada@example.com', 'secret1');
    assert.equal(JSON.parse((await storage.getItem(PLAY)) ?? '{}').best, 0);
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 12);
    online = true;
    await restarted.sync();
    assert.equal(JSON.parse(remote.peek(userId, PLAY)?.payload ?? '{}').best, 0);
  });

  it('does not copy a reset onto another account', async () => {
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    const remote = new MemoryCloudRemote();
    auth.seed('ada@example.com', 'secret1');
    auth.seed('bob@example.com', 'secret2');
    const engine = new CloudSyncEngine(storage, auth, remote);
    const ada = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(ada.ok, true);
    const adaId = ada.ok ? ada.user.id : '';
    await storage.setItem(PLAY, highScore(8, '2026-10-01T00:00:00.000Z'));
    await engine.sync();
    await engine.signOut();
    const bob = await engine.signIn('bob@example.com', 'secret2');
    assert.equal(bob.ok, true);
    await storage.setItem(PLAY, highScore(3, '2026-10-01T00:00:00.000Z'));
    await engine.sync();
    await engine.signOut();
    await engine.signIn('ada@example.com', 'secret1');
    await new PlayMoveRecordsStore(storage).reset('2026-10-06T00:00:00.000Z');
    await engine.sync();
    const bobWorkspace = await storage.getItem(cloudWorkspaceKey(bob.ok ? bob.user.id : ''));
    const parked = JSON.parse(bobWorkspace ?? '{}') as { docs?: Record<string, string | null> };
    assert.equal(JSON.parse(parked.docs?.[PLAY] ?? '{}').best, 3);
    assert.equal(JSON.parse(remote.peek(adaId, PLAY)?.payload ?? '{}').best, 0);
    assert.equal(JSON.parse(remote.peek(bob.ok ? bob.user.id : '', PLAY)?.payload ?? '{}').best, 3);
  });

  it('does not write an older best back when a reset lands during the save', async () => {
    const storage = new MemoryKeyValueStorage();
    const records = new PlayMoveRecordsStore(storage);
    await records.saveScore(12);
    const saved = await records.saveScore(4, {
      afterRead: async () => {
        await records.reset('2026-10-07T00:00:00.000Z');
      },
    });
    assert.equal(saved, 4);
    const doc = JSON.parse((await storage.getItem(PLAY)) ?? '{}') as { best: number; resetAt?: string };
    assert.equal(doc.best, 4);
    assert.equal(doc.resetAt, '2026-10-07T00:00:00.000Z');
  });

  it('ignores a sign-in result that arrives after the form has left', async () => {
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    auth.seed('ada@example.com', 'secret1');
    const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
    const original = auth.signIn.bind(auth);
    let openGate: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    auth.signIn = async (email: string, password: string) => {
      await gate;
      return original(email, password);
    };
    let abandoned = false;
    const pending = engine.signIn('ada@example.com', 'secret1', { abandoned: () => abandoned });
    abandoned = true;
    openGate();
    const result = await pending;
    assert.equal(result.ok, false);
    assert.equal(engine.getState().user, null);
  });

  it('marks a local save failure without claiming the account is synced', async () => {
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
    const storage = new MemoryKeyValueStorage();
    const auth = new MemoryCloudAuth();
    auth.seed('ada@example.com', 'secret1');
    const engine = new CloudSyncEngine(storage, auth, new MemoryCloudRemote());
    const signed = await engine.signIn('ada@example.com', 'secret1');
    assert.equal(signed.ok, true);
    engine.noteLocalSaveFailure();
    assert.equal(engine.getState().status, 'error');
    assert.equal(engine.getState().lastError, 'local_save_failed');
  });
});
