/**
 * Repertoire PGN persistence — content survives a fresh storage load.
 * Uses MemoryKeyValueStorage (no phone filesystem / no account).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { AsyncStorageRepertoireStorage } from '../storage/AsyncStorageRepertoireStorage.ts';
import { buildRepertoire } from '../repertoireTree.ts';
import type { RepertoireStoreSnapshot } from '../storage/types.ts';

const PGN_A = `[Event "Italian"]
1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *`;

const PGN_B = `[Event "Caro"]
1. e4 c6 2. d4 d5 *`;

describe('Repertoire PGN persistence', () => {
  it('persists folders, sides, and PGN text across reload', async () => {
    const mem = new MemoryKeyValueStorage();
    const storage = new AsyncStorageRepertoireStorage(mem);

    const snap: RepertoireStoreSnapshot = {
      version: 2,
      folders: [
        {
          id: 'folder_w',
          name: 'Italien',
          side: 'white',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'folder_b',
          name: 'Caro-Kann',
          side: 'black',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      files: [
        {
          id: 'pgn_a',
          folderId: 'folder_w',
          filename: 'italien.pgn',
          importedAt: '2024-01-01T00:00:00.000Z',
          pgnText: PGN_A.trim(),
          summary: {
            gameCount: 1,
            positionCount: 1,
            branchCount: 1,
            parseSucceeded: true,
            errors: [],
            warnings: [],
          },
          enabled: true,
        },
        {
          id: 'pgn_b',
          folderId: 'folder_b',
          filename: 'caro.pgn',
          importedAt: '2024-01-01T00:00:00.000Z',
          pgnText: PGN_B.trim(),
          summary: {
            gameCount: 1,
            positionCount: 1,
            branchCount: 1,
            parseSucceeded: true,
            errors: [],
            warnings: [],
          },
          enabled: true,
        },
      ],
    };

    await storage.save(snap);

    const raw = await mem.getItem(StorageKeys.repertoires.key);
    assert.ok(raw);
    assert.ok(raw.includes('e4 e5'));
    assert.ok(raw.includes('e4 c6') || raw.includes('caro.pgn'));
    assert.equal(StorageKeys.repertoires.key, 'anychess.repertoire.v2');

    // Fresh storage instance (simulates app restart).
    const storage2 = new AsyncStorageRepertoireStorage(mem);
    const loaded = await storage2.load();

    assert.equal(loaded.version, 2);
    assert.equal(loaded.folders.length, 2);
    const w = loaded.folders.find((f) => f.id === 'folder_w');
    const b = loaded.folders.find((f) => f.id === 'folder_b');
    assert.ok(w);
    assert.ok(b);
    assert.equal(w!.side, 'white');
    assert.equal(b!.side, 'black');

    const filesW = loaded.files.filter((f) => f.folderId === 'folder_w');
    const filesB = loaded.files.filter((f) => f.folderId === 'folder_b');
    assert.equal(filesW.length, 1);
    assert.equal(filesB.length, 1);
    assert.equal(filesW[0]!.pgnText, PGN_A.trim());
    assert.equal(filesB[0]!.pgnText, PGN_B.trim());

    const rebuiltW = buildRepertoire(filesW[0]!.pgnText);
    const rebuiltB = buildRepertoire(filesB[0]!.pgnText);
    assert.ok(rebuiltW.positionCount > 0);
    assert.ok(rebuiltB.positionCount > 0);
  });
});
