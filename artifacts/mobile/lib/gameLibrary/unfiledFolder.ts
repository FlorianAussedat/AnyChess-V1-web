/**
 * System “À classer” folder for the game-analysis library.
 * Independent from the openings unfiled folder.
 */
import type { GameLibraryFolder } from './types.ts';

export const UNFILED_GAME_FOLDER_ID = 'folder_system_unfiled';
export const UNFILED_GAME_FOLDER_KEY = 'unfiled' as const;

export function isUnfiledGameFolder(
  folder: Pick<GameLibraryFolder, 'id' | 'systemKey'> | null | undefined,
): boolean {
  if (!folder) return false;
  return folder.systemKey === UNFILED_GAME_FOLDER_KEY || folder.id === UNFILED_GAME_FOLDER_ID;
}

export function makeUnfiledGameFolder(now = Date.now()): GameLibraryFolder {
  return {
    id: UNFILED_GAME_FOLDER_ID,
    name: 'À classer',
    parentId: null,
    systemKey: UNFILED_GAME_FOLDER_KEY,
    createdAt: now,
    updatedAt: now,
  };
}

export function ensureUnfiledGameFolderInSnapshot(folders: GameLibraryFolder[]): {
  folders: GameLibraryFolder[];
  unfiled: GameLibraryFolder;
  changed: boolean;
} {
  const existing = folders.find((f) => isUnfiledGameFolder(f));
  if (existing) {
    if (existing.systemKey === UNFILED_GAME_FOLDER_KEY && existing.parentId == null) {
      return { folders, unfiled: existing, changed: false };
    }
    const unfiled: GameLibraryFolder = {
      ...existing,
      systemKey: UNFILED_GAME_FOLDER_KEY,
      parentId: null,
    };
    return {
      folders: folders.map((f) => (f.id === existing.id ? unfiled : f)),
      unfiled,
      changed: true,
    };
  }
  const unfiled = makeUnfiledGameFolder();
  return { folders: [unfiled, ...folders], unfiled, changed: true };
}
