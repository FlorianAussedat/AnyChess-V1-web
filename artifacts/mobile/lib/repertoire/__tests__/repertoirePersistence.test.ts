/**
 * PGN repertoire persistence — content (not URI) survives new storage instances.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { AsyncStorageRepertoireStorage } from '../storage/AsyncStorageRepertoireStorage.ts';
import { buildRepertoire } from '../repertoireTree.ts';
import type { RepertoireStoreSnapshot } from '../storage/types.ts';

const MINI_PGN = `[Event "AnyChess Persist"]
[White "W"]
[Black "B"]
1. e4 e5 2. Nf3 Nc6 *`;

describe('repertoire PGN content persistence', () => {
  it('restores folder, side, filename and full pgnText after reload', async () => {
    const kv = new MemoryKeyValueStorage();
    const a = new AsyncStorageRepertoireStorage(kv);
    const parsed = buildRepertoire(MINI_PGN);
    const snapshot: RepertoireStoreSnapshot = {
      version: 2,
      folders: [
        {
          id: 'folder_sic',
          name: 'Sicilienne',
          side: 'black',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      files: [
        {
          id: 'pgn_1',
          folderId: 'folder_sic',
          filename: 'sicilian.pgn',
          importedAt: '2026-01-01T00:00:00.000Z',
          pgnText: MINI_PGN.trim(),
          summary: {
            gameCount: parsed.headers.length,
            positionCount: parsed.positionCount,
            branchCount: parsed.branchCount,
            parseSucceeded: parsed.positionCount > 0,
            errors: parsed.errors,
            warnings: parsed.warnings,
          },
          enabled: true,
        },
      ],
    };
    await a.save(snapshot);

    // Simulate app restart: new adapter instance over same KeyValueStorage.
    const b = new AsyncStorageRepertoireStorage(kv);
    const restored = await b.load();
    assert.equal(restored.folders.length, 1);
    assert.equal(restored.folders[0]!.name, 'Sicilienne');
    assert.equal(restored.folders[0]!.side, 'black');
    assert.equal(restored.files.length, 1);
    assert.equal(restored.files[0]!.filename, 'sicilian.pgn');
    assert.equal(restored.files[0]!.pgnText, MINI_PGN.trim());
    assert.ok(!('uri' in restored.files[0]!));
    assert.ok(!('path' in restored.files[0]!));

    const rebuilt = buildRepertoire(restored.files[0]!.pgnText);
    assert.ok(rebuilt.positionCount > 0);
  });
});
