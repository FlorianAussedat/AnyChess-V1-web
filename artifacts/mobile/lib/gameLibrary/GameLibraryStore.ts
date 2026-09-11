/**
 * Persistent Game Library store (dedicated versioned key).
 * v2 adds folders/subfolders; v1 snapshots migrate automatically.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { displayNameFromFilename } from './displayNameFromFilename.ts';
import {
  collectDescendantFolderIds,
  emptyGameLibrarySnapshotV2,
  migrateGameLibrarySnapshot,
  newLibraryFolderId,
} from './folders.ts';
import { importPgnGames } from './importPgnGames.ts';
import { indexPgnGamesLight } from './indexPgnGamesLight.ts';
import { importSelectedPgnGames } from './importSelectedPgnGames.ts';
import type { PgnGameIndexEntry } from './indexPgnGamesLight.ts';
import type {
  GameLibraryFolder,
  GameLibrarySnapshot,
  ImportedChessGame,
  ImportPgnResult,
} from './types.ts';

export const GAME_LIBRARY_STORAGE_KEY = StorageKeys.gameLibrary.key;

export function emptyGameLibrarySnapshot(): GameLibrarySnapshot {
  return emptyGameLibrarySnapshotV2();
}

export function validateGameLibrarySnapshot(
  raw: unknown,
): GameLibrarySnapshot | null {
  const migrated = migrateGameLibrarySnapshot(raw);
  if (!migrated) return null;
  // Normalize analysis badges (same rules as before).
  for (const game of migrated.games) {
    const analysis = game.analysis;
    if (analysis && typeof analysis === 'object') {
      if (
        analysis.hasBeenAnalyzed === true &&
        typeof analysis.analyzedAt === 'number' &&
        typeof analysis.profileId === 'string' &&
        analysis.profileId.length > 0
      ) {
        /* keep */
      } else {
        delete game.analysis;
      }
    }
  }
  return migrated;
}

export class GameLibraryStore {
  private cache: GameLibrarySnapshot | null = null;
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async getSnapshot(): Promise<GameLibrarySnapshot> {
    if (this.cache) return this.cache;
    try {
      const raw = await this.storage.getItem(GAME_LIBRARY_STORAGE_KEY);
      if (!raw) {
        this.cache = emptyGameLibrarySnapshot();
        return this.cache;
      }
      const parsed = validateGameLibrarySnapshot(JSON.parse(raw));
      this.cache = parsed ?? emptyGameLibrarySnapshot();
      // Persist migration if we upgraded from v1.
      if (parsed && parsed.version === 2) {
        const original = JSON.parse(raw) as { version?: number };
        if (original.version === 1) {
          await this.persist(parsed);
        }
      }
      return this.cache;
    } catch {
      this.cache = emptyGameLibrarySnapshot();
      return this.cache;
    }
  }

  private async persist(
    next: GameLibrarySnapshot,
  ): Promise<GameLibrarySnapshot> {
    this.cache = next;
    await this.storage.setItem(GAME_LIBRARY_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async listGames(folderId?: string | null): Promise<ImportedChessGame[]> {
    const snap = await this.getSnapshot();
    const target = folderId === undefined ? undefined : folderId;
    const games =
      target === undefined
        ? snap.games
        : snap.games.filter((g) => (g.folderId ?? null) === target);
    return [...games].sort(
      (a, b) => (b.source.importedAt ?? 0) - (a.source.importedAt ?? 0),
    );
  }

  async listFolders(parentId: string | null = null): Promise<GameLibraryFolder[]> {
    const snap = await this.getSnapshot();
    return snap.folders
      .filter((f) => (f.parentId ?? null) === parentId)
      .sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
  }

  async getGame(id: string): Promise<ImportedChessGame | null> {
    const snap = await this.getSnapshot();
    return snap.games.find((g) => g.id === id) ?? null;
  }

  async getFolder(id: string): Promise<GameLibraryFolder | null> {
    const snap = await this.getSnapshot();
    return snap.folders.find((f) => f.id === id) ?? null;
  }

  async createFolder(
    name: string,
    parentId: string | null = null,
  ): Promise<GameLibraryFolder> {
    const snap = await this.getSnapshot();
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Le nom du dossier est vide.');
    if (parentId && !snap.folders.some((f) => f.id === parentId)) {
      throw new Error('Dossier parent introuvable.');
    }
    const now = Date.now();
    const folder: GameLibraryFolder = {
      id: newLibraryFolderId(),
      name: trimmed,
      parentId,
      createdAt: now,
      updatedAt: now,
    };
    return (
      await this.persist({
        ...snap,
        folders: [...snap.folders, folder],
      })
    ).folders.find((f) => f.id === folder.id)!;
  }

  async renameFolder(id: string, name: string): Promise<GameLibraryFolder | null> {
    const snap = await this.getSnapshot();
    const trimmed = name.trim();
    if (!trimmed) return null;
    const folders = snap.folders.map((f) =>
      f.id === id ? { ...f, name: trimmed, updatedAt: Date.now() } : f,
    );
    await this.persist({ ...snap, folders });
    return folders.find((f) => f.id === id) ?? null;
  }

  async deleteFolder(
    id: string,
    options?: { deleteContents?: boolean },
  ): Promise<GameLibrarySnapshot> {
    const snap = await this.getSnapshot();
    const deleteContents = options?.deleteContents !== false;
    const ids = new Set(collectDescendantFolderIds(snap.folders, id));
    const folders = snap.folders.filter((f) => !ids.has(f.id));
    const games = deleteContents
      ? snap.games.filter((g) => !g.folderId || !ids.has(g.folderId))
      : snap.games.map((g) =>
          g.folderId && ids.has(g.folderId) ? { ...g, folderId: null } : g,
        );
    return this.persist({ version: 2, folders, games });
  }

  async moveGame(
    gameId: string,
    folderId: string | null,
  ): Promise<ImportedChessGame | null> {
    const snap = await this.getSnapshot();
    if (folderId && !snap.folders.some((f) => f.id === folderId)) {
      throw new Error('Dossier introuvable.');
    }
    const index = snap.games.findIndex((g) => g.id === gameId);
    if (index < 0) return null;
    const updated = { ...snap.games[index]!, folderId };
    const games = [...snap.games];
    games[index] = updated;
    await this.persist({ ...snap, games });
    return updated;
  }

  async renameGame(
    gameId: string,
    displayName: string,
  ): Promise<ImportedChessGame | null> {
    const snap = await this.getSnapshot();
    const index = snap.games.findIndex((g) => g.id === gameId);
    if (index < 0) return null;
    const name = displayName.trim();
    const updated: ImportedChessGame = {
      ...snap.games[index]!,
      displayName: name.length > 0 ? name : undefined,
    };
    const games = [...snap.games];
    games[index] = updated;
    await this.persist({ ...snap, games });
    return updated;
  }

  async importPgnText(
    pgnText: string,
    fileName?: string,
    options?: {
      displayNames?: Record<number, string>;
      folderId?: string | null;
      /** When true (default), stem of fileName becomes displayName if unset. */
      useFileNameAsDisplayName?: boolean;
      /**
       * When set, only these game indices (from light index) are parsed/imported.
       * Omit to import every game in the text (legacy / small files).
       */
      gameIndices?: number[];
      /** Precomputed light index entries (optional; rebuilt when omitted). */
      indexEntries?: PgnGameIndexEntry[];
    },
  ): Promise<ImportPgnResult & { snapshot: GameLibrarySnapshot; parsedCount?: number }> {
    const snap = await this.getSnapshot();
    const existing = new Set(snap.games.map((g) => g.fingerprint));

    let result: ImportPgnResult & { parsedCount?: number };
    if (options?.gameIndices && options.gameIndices.length > 0) {
      const entries =
        options.indexEntries ?? indexPgnGamesLight(pgnText).entries;
      result = importSelectedPgnGames(pgnText, entries, options.gameIndices, {
        fileName,
        existingFingerprints: existing,
        importedAt: Date.now(),
        displayNamesByIndex: options.displayNames,
      });
    } else {
      result = importPgnGames(pgnText, {
        fileName,
        existingFingerprints: existing,
        importedAt: Date.now(),
      });
    }

    if (result.imported.length === 0) {
      return { ...result, snapshot: snap };
    }
    const names = options?.displayNames;
    const folderId = options?.folderId ?? null;
    const useFile =
      options?.useFileNameAsDisplayName !== false
        ? displayNameFromFilename(fileName)
        : '';
    result.imported = result.imported.map((game, index) => {
      const name =
        names?.[index]?.trim() ||
        game.displayName?.trim() ||
        useFile ||
        undefined;
      return {
        ...game,
        displayName: name || undefined,
        folderId,
      };
    });
    const next: GameLibrarySnapshot = {
      version: 2,
      folders: snap.folders,
      games: [...result.imported, ...snap.games],
    };
    await this.persist(next);
    return { ...result, snapshot: next };
  }

  /** Persist already-built imported games (after naming prompts). */
  async addGames(games: ImportedChessGame[]): Promise<GameLibrarySnapshot> {
    if (games.length === 0) {
      return this.getSnapshot();
    }
    const snap = await this.getSnapshot();
    const existing = new Set(snap.games.map((g) => g.fingerprint));
    const fresh = games
      .filter((g) => !existing.has(g.fingerprint))
      .map((g) => ({
        ...g,
        folderId: g.folderId ?? null,
        displayName:
          g.displayName?.trim() ||
          displayNameFromFilename(g.source.fileName) ||
          undefined,
      }));
    const next: GameLibrarySnapshot = {
      version: 2,
      folders: snap.folders,
      games: [...fresh, ...snap.games],
    };
    return this.persist(next);
  }

  async deleteGame(id: string): Promise<GameLibrarySnapshot> {
    const snap = await this.getSnapshot();
    const next: GameLibrarySnapshot = {
      version: 2,
      folders: snap.folders,
      games: snap.games.filter((g) => g.id !== id),
    };
    return this.persist(next);
  }

  async markAnalyzed(
    id: string,
    meta: { profileId: string; analyzedAt?: number },
  ): Promise<ImportedChessGame | null> {
    const snap = await this.getSnapshot();
    const index = snap.games.findIndex((g) => g.id === id);
    if (index < 0) return null;
    const game = snap.games[index]!;
    const updated: ImportedChessGame = {
      ...game,
      analysis: {
        hasBeenAnalyzed: true,
        analyzedAt: meta.analyzedAt ?? Date.now(),
        profileId: meta.profileId,
      },
    };
    const games = [...snap.games];
    games[index] = updated;
    await this.persist({ version: 2, folders: snap.folders, games });
    return updated;
  }
}

export const gameLibraryStore = new GameLibraryStore();
