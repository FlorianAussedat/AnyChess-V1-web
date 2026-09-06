/**
 * Persistent Game Library store (dedicated versioned key).
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { importPgnGames } from './importPgnGames.ts';
import type {
  GameLibrarySnapshot,
  ImportedChessGame,
  ImportPgnResult,
} from './types.ts';

export const GAME_LIBRARY_STORAGE_KEY = StorageKeys.gameLibrary.key;

export function emptyGameLibrarySnapshot(): GameLibrarySnapshot {
  return { version: 1, games: [] };
}

export function validateGameLibrarySnapshot(raw: unknown): GameLibrarySnapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as { version?: unknown; games?: unknown };
  if (o.version !== 1 || !Array.isArray(o.games)) return null;
  const games: ImportedChessGame[] = [];
  for (const g of o.games) {
    if (!g || typeof g !== 'object') continue;
    const game = g as ImportedChessGame;
    if (typeof game.id !== 'string' || !Array.isArray(game.moves)) continue;
    if (typeof game.initialFen !== 'string' || typeof game.fingerprint !== 'string') {
      continue;
    }
    if (typeof game.hasVariations !== 'boolean') {
      game.hasVariations = false;
    }
    if (typeof (game as { displayName?: unknown }).displayName === 'string') {
      const dn = (game as { displayName: string }).displayName.trim();
      game.displayName = dn.length > 0 ? dn : undefined;
    }
    const analysis = (game as { analysis?: unknown }).analysis;
    if (analysis && typeof analysis === 'object' && !Array.isArray(analysis)) {
      const a = analysis as {
        hasBeenAnalyzed?: unknown;
        analyzedAt?: unknown;
        profileId?: unknown;
      };
      if (
        a.hasBeenAnalyzed === true &&
        typeof a.analyzedAt === 'number' &&
        typeof a.profileId === 'string' &&
        a.profileId.length > 0
      ) {
        game.analysis = {
          hasBeenAnalyzed: true,
          analyzedAt: a.analyzedAt,
          profileId: a.profileId,
        };
      } else {
        delete game.analysis;
      }
    } else {
      delete game.analysis;
    }
    games.push(game);
  }
  return { version: 1, games };
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
      return this.cache;
    } catch {
      this.cache = emptyGameLibrarySnapshot();
      return this.cache;
    }
  }

  private async persist(next: GameLibrarySnapshot): Promise<GameLibrarySnapshot> {
    this.cache = next;
    await this.storage.setItem(GAME_LIBRARY_STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async listGames(): Promise<ImportedChessGame[]> {
    const snap = await this.getSnapshot();
    return [...snap.games].sort(
      (a, b) => (b.source.importedAt ?? 0) - (a.source.importedAt ?? 0),
    );
  }

  async getGame(id: string): Promise<ImportedChessGame | null> {
    const snap = await this.getSnapshot();
    return snap.games.find((g) => g.id === id) ?? null;
  }

  async importPgnText(
    pgnText: string,
    fileName?: string,
    options?: { displayNames?: Record<number, string> },
  ): Promise<ImportPgnResult & { snapshot: GameLibrarySnapshot }> {
    const snap = await this.getSnapshot();
    const existing = new Set(snap.games.map((g) => g.fingerprint));
    const result = importPgnGames(pgnText, {
      fileName,
      existingFingerprints: existing,
      importedAt: Date.now(),
    });
    if (result.imported.length === 0) {
      return { ...result, snapshot: snap };
    }
    const names = options?.displayNames;
    if (names) {
      result.imported = result.imported.map((game, index) => {
        const name = names[index]?.trim();
        return name ? { ...game, displayName: name } : game;
      });
    }
    const next: GameLibrarySnapshot = {
      version: 1,
      games: [...result.imported, ...snap.games],
    };
    await this.persist(next);
    return { ...result, snapshot: next };
  }

  
  /** Persist already-built imported games (after naming prompts). */
  async addGames(
    games: ImportedChessGame[],
  ): Promise<GameLibrarySnapshot> {
    if (games.length === 0) {
      return this.getSnapshot();
    }
    const snap = await this.getSnapshot();
    const existing = new Set(snap.games.map((g) => g.fingerprint));
    const fresh = games.filter((g) => !existing.has(g.fingerprint));
    const next: GameLibrarySnapshot = {
      version: 1,
      games: [...fresh, ...snap.games],
    };
    return this.persist(next);
  }

  async deleteGame(id: string): Promise<GameLibrarySnapshot> {
    const snap = await this.getSnapshot();
    const next: GameLibrarySnapshot = {
      version: 1,
      games: snap.games.filter((g) => g.id !== id),
    };
    return this.persist(next);
  }

  /**
   * Persist minimal AnyLyseur metadata so the library can show « Analysée »
   * without storing engine lines.
   */
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
    await this.persist({ version: 1, games });
    return updated;
  }
}

export const gameLibraryStore = new GameLibraryStore();
