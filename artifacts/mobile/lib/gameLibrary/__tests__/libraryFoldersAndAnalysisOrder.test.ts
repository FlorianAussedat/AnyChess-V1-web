import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { displayNameFromFilename, MAX_PGN_IMPORT_BATCH } from '../displayNameFromFilename.ts';
import {
  collectDescendantFolderIds,
  countFolderContents,
  migrateGameLibrarySnapshot,
} from '../folders.ts';
import { GameLibraryStore } from '../GameLibraryStore.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { orderNodesForBackgroundAnalysis } from '../../analysis/orderBackgroundAnalysis.ts';
import {
  getFolderRepertoireCache,
  makeFolderRepertoireCacheKey,
  resetFolderRepertoireCacheForTests,
  setFolderRepertoireCache,
} from '../../repertoire/folderRepertoireCache.ts';
import { undoPlayerTurn } from '../../game/undoPlayerTurn.ts';
import { Chess } from 'chess.js';

describe('displayNameFromFilename', () => {
  it('strips path and .pgn extension', () => {
    assert.equal(
      displayNameFromFilename('Kasparov-Karpov-Moscow-1985.pgn'),
      'Kasparov-Karpov-Moscow-1985',
    );
    assert.equal(
      displayNameFromFilename('/tmp/foo/Bar.PGN'),
      'Bar',
    );
  });

  it('exports a batch cap of 10', () => {
    assert.equal(MAX_PGN_IMPORT_BATCH, 10);
  });
});

describe('game library folders', () => {
  it('creates nested folders, moves games, renames, deletes with contents', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new GameLibraryStore(storage);
    const root = await store.createFolder('Mes parties');
    const child = await store.createFolder('Tournois', root.id);
    assert.equal(child.parentId, root.id);

    const imported = await store.importPgnText(
      '[White "A"]\n[Black "B"]\n\n1. e4 e5 *',
      'Kasparov-Karpov-Moscow-1985.pgn',
      { folderId: child.id },
    );
    assert.equal(imported.imported[0]?.displayName, 'Kasparov-Karpov-Moscow-1985');
    assert.equal(imported.imported[0]?.folderId, child.id);

    const renamed = await store.renameGame(
      imported.imported[0]!.id,
      'Finale Moscou',
    );
    assert.equal(renamed?.displayName, 'Finale Moscou');

    await store.moveGame(imported.imported[0]!.id, null);
    assert.equal((await store.getGame(imported.imported[0]!.id))?.folderId, null);

    await store.moveGame(imported.imported[0]!.id, child.id);
    const snap = await store.getSnapshot();
    const counts = countFolderContents(snap, root.id);
    assert.equal(counts.subfolders, 1);

    const ids = collectDescendantFolderIds(snap.folders, root.id);
    assert.ok(ids.includes(root.id) && ids.includes(child.id));

    await store.deleteFolder(root.id, { deleteContents: true });
    const after = await store.getSnapshot();
    assert.equal(after.folders.length, 0);
    assert.equal(after.games.length, 0);
  });

  it('migrates v1 → v2', () => {
    const migrated = migrateGameLibrarySnapshot({
      version: 1,
      games: [],
    });
    assert.equal(migrated?.version, 2);
    assert.deepEqual(migrated?.folders, []);
  });
});

describe('orderNodesForBackgroundAnalysis', () => {
  it('prioritizes forward active-line nodes before filling main line', () => {
    const main = [
      { nodeId: 's', fen: 'start' },
      { nodeId: '1', fen: 'f1' },
      { nodeId: '2', fen: 'f2' },
      { nodeId: '3', fen: 'f3' },
    ];
    const active = [
      { nodeId: '1', fen: 'f1' },
      { nodeId: '2', fen: 'f2' },
      { nodeId: '2b', fen: 'f2b' },
    ];
    const ordered = orderNodesForBackgroundAnalysis({
      mainLine: main,
      activeLine: active,
      currentFen: 'f2',
    });
    assert.equal(ordered[0]?.nodeId, '2b');
    assert.ok(ordered.some((n) => n.nodeId === 's'));
    assert.ok(ordered.some((n) => n.nodeId === '3'));
  });
});

describe('folder repertoire cache', () => {
  it('hits cache for identical keys', () => {
    resetFolderRepertoireCacheForTests();
    const key = makeFolderRepertoireCacheKey('f1', ['a', 'b']);
    setFolderRepertoireCache({
      key,
      repertoire: {
        index: new Map(),
        headers: [],
        errors: [],
        warnings: [],
        branchCount: 0,
        positionCount: 0,
      },
      fileCount: 2,
      issues: [],
      builtAt: 1,
      buildMs: 12,
    });
    assert.equal(getFolderRepertoireCache(key)?.buildMs, 12);
  });
});

describe('undoPlayerTurn STM safety', () => {
  it('does not pop an earlier reply when undoing a pending player ply', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    const result = undoPlayerTurn(game, 'w');
    assert.equal(result.kind, 'undone');
    assert.deepEqual(game.history(), ['e4', 'e5']);
  });
});
