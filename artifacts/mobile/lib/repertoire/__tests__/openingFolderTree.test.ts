/**
 * Hierarchical opening folders: tree, moves, safe delete, migration, sync, learning.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import { mergeDocumentPayload } from '../../cloud/mergeDocuments.ts';
import { AsyncStorageRepertoireStorage } from '../storage/AsyncStorageRepertoireStorage.ts';
import type { RepertoireStorage } from '../storage/RepertoireStorage.ts';
import {
  emptyRepertoireStore,
  normalizeRepertoireStore,
  type RepertoireStoreSnapshot,
} from '../storage/types.ts';
import { RepertoireService } from '../RepertoireService.ts';
import { OpeningMasteryStore } from '../OpeningMasteryStore.ts';
import {
  canMoveOpeningFolder,
  flattenOpeningTree,
  migrateOpeningHierarchy,
  openingTreeIndent,
  OPENING_TREE_MAX_INDENT_DEPTH,
} from '../folderTree.ts';
import { loadExpandedFolderIds, saveExpandedFolderIds } from '../folderTreeExpanded.ts';
import { learningFilesInFolder } from '../learningScope.ts';
import { listReviewPoolEntries, pickReviewLine } from '../pickReviewLine.ts';
import type { RepertoireSide } from '../storage/types.ts';

const PGN_A = '1. e4 e5 2. Nf3 Nc6 *';
const PGN_B = '1. e4 c5 2. Nf3 d6 *';

function memoryStorage(): RepertoireStorage & { peek(): RepertoireStoreSnapshot } {
  let snap = emptyRepertoireStore();
  return {
    async load() {
      return migrateOpeningHierarchy(structuredClone(snap)).snapshot;
    },
    async save(next) {
      snap = structuredClone(next);
    },
    async clear() {
      snap = emptyRepertoireStore();
    },
    peek() {
      return snap;
    },
  };
}

async function service() {
  const storage = memoryStorage();
  const svc = new RepertoireService(storage);
  await svc.ensureLoaded();
  return { svc, storage };
}

describe('opening folder tree', () => {
  it('creates nested folders with stable ids and sibling names', async () => {
    const { svc } = await service();
    const italian = await svc.createFolder('Italienne', 'white');
    const piano = await svc.createFolder('Giuoco Piano', 'white', true, italian.id);
    const main = await svc.createFolder('Variante principale', 'black', true, piano.id);
    const again = await svc.createFolder('Variante principale', 'white');
    assert.notEqual(piano.id, italian.id);
    assert.equal(piano.parentId, italian.id);
    assert.equal(main.parentId, piano.id);
    assert.equal(main.side, 'white');
    assert.equal(again.parentId, null);
    assert.equal(again.side, 'white');
    await assert.rejects(() => svc.createFolder('Giuoco Piano', 'white', true, italian.id));
  });

  it('flattens levels with folders before studies and independent expansion', async () => {
    const { svc } = await service();
    const italian = await svc.createFolder('Italienne', 'white');
    const piano = await svc.createFolder('Giuoco Piano', 'white', true, italian.id);
    const knights = await svc.createFolder('Deux Cavaliers', 'white', true, italian.id);
    const pianoFile = await svc.importPgn(piano.id, 'piano.pgn', PGN_A, 'Variante principale');
    const italianFile = await svc.importPgn(italian.id, 'ital.pgn', PGN_B, 'Étude racine');
    const folders = svc.getFolders();
    const files = svc.getAllFiles();
    const roots = folders.filter((folder) => folder.id === italian.id);

    const both = flattenOpeningTree(folders, files, roots, new Set([italian.id, piano.id, knights.id]));
    const kinds = both.map((row) =>
      row.kind === 'folder' ? `folder:${row.folder.name}@${row.depth}` : `file:${row.file.displayName}@${row.depth}`,
    );
    assert.deepEqual(kinds, [
      'folder:Italienne@0',
      'folder:Deux Cavaliers@1',
      'folder:Giuoco Piano@1',
      'file:Variante principale@2',
      'file:Étude racine@1',
    ]);

    const onlyKnights = flattenOpeningTree(folders, files, roots, new Set([italian.id, knights.id]));
    assert.equal(onlyKnights.some((row) => row.kind === 'file' && row.file.id === pianoFile.id), false);
    assert.equal(onlyKnights.some((row) => row.kind === 'file' && row.file.id === italianFile.id), true);
    assert.equal(onlyKnights.some((row) => row.kind === 'folder' && row.folder.id === piano.id && row.expanded), false);

    const collapsed = flattenOpeningTree(folders, files, roots, new Set());
    assert.equal(collapsed.length, 1);
    assert.equal(openingTreeIndent(0), 0);
    assert.equal(openingTreeIndent(99), OPENING_TREE_MAX_INDENT_DEPTH * 12);
  });

  it('renames a folder without touching its studies', async () => {
    const { svc } = await service();
    const folder = await svc.createFolder('Italienne', 'white');
    const file = await svc.importPgn(folder.id, 'line.pgn', PGN_A, 'Piano');
    const renamed = await svc.renameFolder(folder.id, 'Partie italienne');
    const stored = svc.getFile(file.id)!;
    assert.equal(renamed.id, folder.id);
    assert.equal(renamed.name, 'Partie italienne');
    assert.equal(stored.pgnText, PGN_A);
    assert.equal(stored.displayName, 'Piano');
    assert.equal(stored.folderId, folder.id);
  });

  it('moves one study and a batch without changing ids or PGN', async () => {
    const { svc } = await service();
    const from = await svc.createFolder('Source', 'white');
    const to = await svc.createFolder('Cible', 'black');
    const nested = await svc.createFolder('Sous-dossier', 'black', true, to.id);
    const a = await svc.importPgn(from.id, 'a.pgn', PGN_A, 'Étude A');
    const b = await svc.importPgn(from.id, 'b.pgn', PGN_B, 'Étude B');
    const moved = await svc.movePgn(a.id, nested.id);
    assert.equal(moved.id, a.id);
    assert.equal(moved.folderId, nested.id);
    assert.equal(moved.pgnText, PGN_A);
    const batch = await svc.movePgns([a.id, b.id], to.id);
    assert.deepEqual(batch.map((file) => file.id).sort(), [a.id, b.id].sort());
    assert.ok(batch.every((file) => file.folderId === to.id));
    assert.equal(svc.getFile(b.id)!.pgnText, PGN_B);
  });

  it('moves a folder with its descendants and refuses cycles', async () => {
    const { svc } = await service();
    const white = await svc.createFolder('Italienne', 'white');
    const piano = await svc.createFolder('Giuoco Piano', 'white', true, white.id);
    const line = await svc.createFolder('7.Fc4', 'white', true, piano.id);
    const black = await svc.createFolder('Sicilienne', 'black');
    const file = await svc.importPgn(line.id, 'fc4.pgn', PGN_A);
    const moved = await svc.moveFolder(piano.id, black.id);
    assert.equal(moved.parentId, black.id);
    assert.equal(moved.side, 'black');
    assert.equal(svc.getFolder(line.id)!.parentId, piano.id);
    assert.equal(svc.getFolder(line.id)!.side, 'black');
    assert.equal(svc.getFile(file.id)!.folderId, line.id);
    assert.equal(svc.getFile(file.id)!.pgnText, PGN_A);
    assert.equal(canMoveOpeningFolder(svc.getFolders(), piano.id, line.id), false);
    await assert.rejects(() => svc.moveFolder(piano.id, line.id), /sous-dossier|itself|subfolder/i);
    await assert.rejects(() => svc.moveFolder(piano.id, piano.id), /sous-dossier|itself|subfolder/i);
  });

  it('deletes an empty folder and relocates a non-empty one without dropping studies', async () => {
    const { svc } = await service();
    const parent = await svc.createFolder('Dragon', 'black');
    const child = await svc.createFolder('Maroczy', 'black', true, parent.id);
    const empty = await svc.createFolder('Vide', 'black', true, parent.id);
    const file = await svc.importPgn(child.id, 'maroczy.pgn', PGN_B, 'Étau');
    const grand = await svc.createFolder('6.Fe3', 'black', true, child.id);
    await assert.rejects(() => svc.deleteFolder(child.id));
    assert.equal(svc.getFile(file.id)!.pgnText, PGN_B);
    await svc.deleteFolder(empty.id);
    assert.equal(svc.getFolder(empty.id), null);
    await svc.deleteFolder(child.id, { relocateContents: true });
    assert.equal(svc.getFolder(child.id), null);
    assert.equal(svc.getFolder(grand.id)!.parentId, parent.id);
    assert.equal(svc.getFile(file.id)!.id, file.id);
    assert.equal(svc.getFile(file.id)!.folderId, parent.id);
    assert.equal(svc.getFile(file.id)!.pgnText, PGN_B);
  });

  it('migrates legacy folders in place and keeps PGN plus mastery', async () => {
    const kv = new MemoryKeyValueStorage();
    const legacy: RepertoireStoreSnapshot = {
      version: 2,
      folders: [
        {
          id: 'folder_sic',
          name: 'Sicilienne',
          side: 'black' as RepertoireSide,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      files: [
        {
          id: 'pgn_keep',
          folderId: 'folder_sic',
          filename: 'sic.pgn',
          displayName: 'Najdorf',
          importedAt: '2026-01-01T00:00:00.000Z',
          pgnText: PGN_B,
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
    const storage = new AsyncStorageRepertoireStorage(kv);
    await storage.save(legacy);
    const loaded = await storage.load();
    assert.equal(loaded.folders[0]!.id, 'folder_sic');
    assert.equal(loaded.folders[0]!.parentId, null);
    assert.equal(loaded.files[0]!.id, 'pgn_keep');
    assert.equal(loaded.files[0]!.pgnText, PGN_B);
    assert.equal(loaded.files[0]!.displayName, 'Najdorf');
    const persisted = JSON.parse((await kv.getItem(StorageKeys.repertoires.key)) ?? '{}') as RepertoireStoreSnapshot;
    assert.equal(persisted.folders[0]!.parentId, null);
    assert.equal(persisted.files[0]!.pgnText, PGN_B);

    const restarted = await new AsyncStorageRepertoireStorage(kv).load();
    assert.equal(restarted.files[0]!.id, 'pgn_keep');
    assert.equal(restarted.folders[0]!.name, 'Sicilienne');

    const mastery = new OpeningMasteryStore(kv);
    await mastery.recordResult('pgn_keep', 'line-1', 'success', '2026-02-01T00:00:00.000Z');
    const svc = new RepertoireService(storage);
    await svc.ensureLoaded();
    const target = await svc.createFolder('Autre', 'white');
    await svc.movePgn('pgn_keep', target.id);
    assert.equal(svc.getFile('pgn_keep')!.pgnText, PGN_B);
    assert.deepEqual(mastery.historyFor('pgn_keep', 'line-1'), ['success']);
    assert.equal((await mastery.ensureLoaded()).lines['pgn_keep:line-1']?.totalSuccesses, 1);
  });

  it('trains every study under a parent and does not weight lines by depth', async () => {
    const { svc } = await service();
    const dragon = await svc.createFolder('Dragon accéléré', 'black');
    const anti = await svc.createFolder('Anti-Siciliennes', 'black', true, dragon.id);
    const alapin = await svc.createFolder('Alapine', 'black', true, anti.id);
    const rootFile = await svc.importPgn(dragon.id, 'root.pgn', PGN_A);
    const leafFile = await svc.importPgn(alapin.id, 'alapin.pgn', PGN_B);
    const subtree = svc.getFilesInSubtree(dragon.id).map((file) => file.id).sort();
    assert.deepEqual(subtree, [leafFile.id, rootFile.id].sort());
    assert.deepEqual(
      learningFilesInFolder(svc.getAllFiles(), alapin.id, svc.getFolders()).map((file) => file.id),
      [leafFile.id],
    );
    const built = await svc.buildFolderRepertoire(dragon.id);
    assert.equal(built.fileCount, 2);
    assert.ok(built.repertoire.positionCount > 0);

    const entries = listReviewPoolEntries(svc.getFolders(), svc.getAllFiles());
    assert.equal(entries.length, 2);
    const flat = entries.flatMap((entry) => entry.paths.map(() => entry.file.id));
    assert.equal(flat.length, entries.reduce((sum, entry) => sum + entry.paths.length, 0));
    const first = pickReviewLine(entries, { rng: () => 0 });
    const last = pickReviewLine(entries, { rng: () => 0.999 });
    assert.ok(first && last);
    assert.notEqual(first.file.id, last.file.id);
    const counts = new Map<string, number>();
    for (let i = 0; i < flat.length; i += 1) {
      const pick = pickReviewLine(entries, { rng: () => (i + 0.01) / flat.length });
      counts.set(pick!.file.id, (counts.get(pick!.file.id) ?? 0) + 1);
    }
    assert.equal(counts.get(rootFile.id), entries.find((entry) => entry.file.id === rootFile.id)!.paths.length);
    assert.equal(counts.get(leafFile.id), entries.find((entry) => entry.file.id === leafFile.id)!.paths.length);
  });

  it('syncs and restores parent links without duplicating studies', () => {
    const file = {
      id: 'pgn_keep',
      folderId: 'child',
      filename: 'a.pgn',
      pgnText: PGN_A,
      importedAt: '2026-03-01T00:00:00.000Z',
      summary: { gameCount: 1, positionCount: 1, branchCount: 1, parseSucceeded: true, errors: [], warnings: [] },
    };
    const local = JSON.stringify({
      version: 2,
      folders: [
        { id: 'root', name: 'Italienne', side: 'white', parentId: null, createdAt: '2026-01-01', updatedAt: '2026-04-01' },
        { id: 'child', name: 'Giuoco Piano', side: 'white', parentId: 'root', createdAt: '2026-01-01', updatedAt: '2026-04-01' },
      ],
      files: [file],
    });
    const remote = JSON.stringify({
      version: 2,
      folders: [
        { id: 'root', name: 'Italienne', side: 'white', createdAt: '2026-01-01', updatedAt: '2026-01-02' },
      ],
      files: [{ ...file, folderId: 'root', pgnText: '1. d4 *' }],
    });
    const merged = JSON.parse(mergeDocumentPayload(StorageKeys.repertoires.key, local, remote) ?? '{}') as RepertoireStoreSnapshot;
    const child = merged.folders.find((folder) => folder.id === 'child');
    assert.equal(child?.parentId, 'root');
    assert.equal(merged.files.length, 1);
    const kept = merged.files.find((item) => item.id === 'pgn_keep');
    assert.ok(kept);
    assert.equal(kept!.pgnText, PGN_A);
    assert.equal(kept!.folderId, 'child');

    const cycled = migrateOpeningHierarchy({
      version: 2,
      folders: [
        { id: 'a', name: 'A', parentId: 'b' },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
      files: [{ id: 'f', folderId: 'a', filename: 'a.pgn', pgnText: PGN_A }],
    });
    const parents = new Map(cycled.snapshot.folders.map((folder) => [folder.id, folder.parentId]));
    assert.ok(parents.get('a') == null || parents.get('b') == null);
    assert.equal(cycled.snapshot.files[0]!.pgnText, PGN_A);
    assert.equal(normalizeRepertoireStore({
      version: 2,
      folders: [{ id: 'legacy', name: 'Ancien', side: 'white', createdAt: '', updatedAt: '' }],
      files: [],
    }).folders[0]!.parentId, null);
  });

  it('remembers which folders are open after a restart', async () => {
    const kv = new MemoryKeyValueStorage();
    await saveExpandedFolderIds(['italian', 'piano', 'italian'], kv);
    const restored = await loadExpandedFolderIds(kv);
    assert.deepEqual(restored, ['italian', 'piano']);
    const again = await loadExpandedFolderIds(kv);
    assert.deepEqual(again, restored);
  });
});
