/**
 * Openings PGN import — light index + mandatory folder + file CRUD contracts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { indexPgnGamesLight } from '../../gameLibrary/indexPgnGamesLight.ts';
import { MAX_OPENINGS_PGN_IMPORT_BATCH } from '../../gameLibrary/displayNameFromFilename.ts';
import { joinSelectedPgnSlices } from '../joinSelectedPgnSlices.ts';
import { AsyncStorageRepertoireStorage } from '../storage/AsyncStorageRepertoireStorage.ts';
import {
  emptyRepertoireStore,
  pgnFileDisplayName,
  type RepertoireStoreSnapshot,
  type StoredPgnFile,
} from '../storage/types.ts';
import { buildRepertoire } from '../repertoireTree.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

const MULTI = `[Event "A"]
[White "W1"]
[Black "B1"]
[Result "1-0"]

1. e4 e5 1-0

[Event "B"]
[White "W2"]
[Black "B2"]
[Result "0-1"]

1. d4 d5 0-1

[Event "C"]
[White "W3"]
[Black "B3"]
[Result "*"]

1. c4 c5 *
`;

describe('openings light PGN selection', () => {
  it('indexes without building full trees then joins only selected slices', () => {
    const indexed = indexPgnGamesLight(MULTI);
    assert.equal(indexed.entries.length, 3);
    assert.equal(MAX_OPENINGS_PGN_IMPORT_BATCH, 100);
    const joined = joinSelectedPgnSlices(MULTI, indexed.entries, [0, 2]);
    assert.match(joined, /Event "A"/);
    assert.match(joined, /Event "C"/);
    assert.doesNotMatch(joined, /Event "B"/);
    // Full parse only on the joined selection
    const parsed = buildRepertoire(joined);
    assert.equal(parsed.headers.length, 2);
  });
});

describe('repertoire folder-required persistence', () => {
  it('stores displayName, moves between folders, cascade deletes with folder', async () => {
    const kv = new MemoryKeyValueStorage();
    const storage = new AsyncStorageRepertoireStorage(kv);
    const parsed = buildRepertoire(
      joinSelectedPgnSlices(MULTI, indexPgnGamesLight(MULTI).entries, [0, 1]),
    );
    const file: StoredPgnFile = {
      id: 'pgn_1',
      folderId: 'folder_a',
      filename: 'lines.pgn',
      displayName: 'Mes lignes',
      importedAt: '2026-01-01T00:00:00.000Z',
      pgnText: joinSelectedPgnSlices(
        MULTI,
        indexPgnGamesLight(MULTI).entries,
        [0, 1],
      ),
      summary: {
        gameCount: parsed.headers.length,
        positionCount: parsed.positionCount,
        branchCount: parsed.branchCount,
        parseSucceeded: parsed.positionCount > 0,
        errors: [],
        warnings: [],
      },
      enabled: true,
    };
    const snap: RepertoireStoreSnapshot = {
      version: 2,
      folders: [
        {
          id: 'folder_a',
          name: 'Sicilienne',
          side: 'black',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'folder_b',
          name: 'Française',
          side: 'white',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      files: [file],
    };
    await storage.save(snap);

    // Rename display only
    file.displayName = 'Sicilienne A';
    assert.equal(pgnFileDisplayName(file), 'Sicilienne A');
    assert.equal(file.filename, 'lines.pgn');

    // Move
    file.folderId = 'folder_b';
    await storage.save({ ...snap, files: [file] });
    const reloaded = await storage.load();
    assert.equal(reloaded.files[0]!.folderId, 'folder_b');

    // Cascade delete folder B + its files
    await storage.save({
      version: 2,
      folders: reloaded.folders.filter((f) => f.id !== 'folder_b'),
      files: reloaded.files.filter((f) => f.folderId !== 'folder_b'),
    });
    const after = await storage.load();
    assert.equal(after.folders.length, 1);
    assert.equal(after.files.length, 0);
    assert.equal(emptyRepertoireStore().files.length, 0);
  });
});

describe('RepertoireService openings APIs (source)', () => {
  it('exposes rename/move/copy and never auto-creates unclassified root files', () => {
    const src = read('lib/repertoire/RepertoireService.ts');
    assert.match(src, /renamePgnDisplayName/);
    assert.match(src, /movePgn/);
    assert.match(src, /copyPgnToFolder/);
    assert.match(src, /displayName/);
    // import always requires folderId — no root path
    assert.match(src, /async importPgn\(\s*folderId/);
  });

  it('PgnGameSelectModal accepts maxSelection for openings cap 100', () => {
    const modal = read('components/parties/PgnGameSelectModal.tsx');
    assert.match(modal, /maxSelection/);
    const constants = read('lib/gameLibrary/displayNameFromFilename.ts');
    assert.match(constants, /MAX_OPENINGS_PGN_IMPORT_BATCH\s*=\s*100/);
  });
});
