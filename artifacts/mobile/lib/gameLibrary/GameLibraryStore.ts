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
    const next: GameLibrarySnapshot = {
      version: 1,
      games: [...result.imported, ...snap.games],
    };
    await this.persist(next);
    return { ...result, snapshot: next };
  }

  async deleteGame(id: string): Promise<GameLibrarySnapshot> {
    const snap = await this.getSnapshot();
    const next: GameLibrarySnapshot = {
      version: 1,
      games: snap.games.filter((g) => g.id !== id),
    };
    return this.persist(next);
  }
}

export const gameLibraryStore = new GameLibraryStore();
