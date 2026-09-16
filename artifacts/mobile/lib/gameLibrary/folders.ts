/**
 * Game library folder helpers + v1→v2 migration.
 */
import type {
  GameLibraryFolder,
  GameLibrarySnapshot,
  GameLibrarySnapshotV1,
  ImportedChessGame,
} from './types.ts';

export function newLibraryFolderId(): string {
  return `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyGameLibrarySnapshotV2(): GameLibrarySnapshot {
  return { version: 2, games: [], folders: [] };
}

export function migrateGameLibrarySnapshot(
  raw: unknown,
): GameLibrarySnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as {
    version?: unknown;
    games?: unknown;
    folders?: unknown;
  };

  if (o.version === 1 && Array.isArray(o.games)) {
    const v1 = raw as GameLibrarySnapshotV1;
    return {
      version: 2,
      folders: [],
      games: v1.games.map((g) => ({
        ...g,
        folderId: g.folderId ?? null,
      })),
    };
  }

  if (o.version !== 2 || !Array.isArray(o.games)) return null;

  const folders: GameLibraryFolder[] = [];
  if (Array.isArray(o.folders)) {
    for (const f of o.folders) {
      if (!f || typeof f !== 'object') continue;
      const folder = f as GameLibraryFolder;
      if (typeof folder.id !== 'string' || typeof folder.name !== 'string') {
        continue;
      }
      folders.push({
        id: folder.id,
        name: folder.name.trim() || 'Dossier',
        parentId:
          typeof folder.parentId === 'string' ? folder.parentId : null,
        createdAt:
          typeof folder.createdAt === 'number' ? folder.createdAt : Date.now(),
        updatedAt:
          typeof folder.updatedAt === 'number' ? folder.updatedAt : Date.now(),
      });
    }
  }

  const folderIds = new Set(folders.map((f) => f.id));
  const games: ImportedChessGame[] = [];
  for (const g of o.games) {
    if (!g || typeof g !== 'object') continue;
    const game = g as ImportedChessGame;
    if (typeof game.id !== 'string' || !Array.isArray(game.moves)) continue;
    if (
      typeof game.initialFen !== 'string' ||
      typeof game.fingerprint !== 'string'
    ) {
      continue;
    }
    if (typeof game.hasVariations !== 'boolean') game.hasVariations = false;
    if (typeof game.displayName === 'string') {
      const dn = game.displayName.trim();
      game.displayName = dn.length > 0 ? dn : undefined;
    }
    const fid = game.folderId;
    game.folderId =
      typeof fid === 'string' && folderIds.has(fid) ? fid : null;
    games.push(game);
  }

  // Drop folders whose parent is missing (reattach to root).
  for (const folder of folders) {
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      folder.parentId = null;
    }
  }

  return { version: 2, folders, games };
}

export function listChildFolders(
  folders: GameLibraryFolder[],
  parentId: string | null,
): GameLibraryFolder[] {
  return folders
    .filter((f) => (f.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
}

export function countFolderContents(
  snap: GameLibrarySnapshot,
  folderId: string,
): { games: number; subfolders: number } {
  const games = snap.games.filter((g) => g.folderId === folderId).length;
  const subfolders = snap.folders.filter((f) => f.parentId === folderId).length;
  return { games, subfolders };
}

/** Collect folder id + all descendant folder ids. */
export function collectDescendantFolderIds(
  folders: GameLibraryFolder[],
  rootId: string,
): string[] {
  const ids = [rootId];
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const f of folders) {
      if (f.parentId === id) {
        ids.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return ids;
}
