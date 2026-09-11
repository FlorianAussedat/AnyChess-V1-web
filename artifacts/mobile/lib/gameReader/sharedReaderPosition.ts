/**
 * Shared Lecteur ↔ AnyLyseur session.
 *
 * Durable (versioned) persistence under StorageKeys.gameSession.
 * Autosave is debounced — call `scheduleSaveSharedGameSession` on selection /
 * tree changes only. Do **not** schedule saves on Stockfish UCI ticks.
 *
 * Never calls AsyncStorage.clear(); clears only the session key via
 * `clearSharedGameSession`.
 */
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import type { ReaderGame } from './types.ts';

export const SHARED_GAME_SESSION_VERSION = 1 as const;
export const SHARED_GAME_SESSION_STORAGE_KEY = StorageKeys.gameSession.key;

/** Default debounce for selection/tree autosave (ms). */
export const SHARED_GAME_SESSION_DEBOUNCE_MS = 300;

export type SharedAnalysisCacheSummary = {
  /** How many tree nodes have a cached analysis entry. */
  analyzedNodeCount: number;
  /** Last position FEN that was analyzed (not a full engine dump). */
  lastFen?: string;
  profileId?: string;
};

/**
 * Versioned Lecteur/AnyLyseur session document.
 * Persists the ReaderGame (including exploration mutations), selection, and
 * lightweight analysis prefs — not a full Stockfish dump.
 */
export type SharedGameSession = {
  version: typeof SHARED_GAME_SESSION_VERSION;
  gameId: string;
  /** Serialized reader game including exploration tree mutations. */
  game: ReaderGame;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  boardFlipped: boolean;
  /**
   * Return point before first manual exploration move.
   * `null` = unset; `''` = start; otherwise a node id.
   */
  explorationOriginNodeId: string | null;
  analysisProfileId?: 'fast' | 'normal' | 'deep';
  analysisCacheSummary?: SharedAnalysisCacheSummary;
  updatedAt: number;
};

/** Legacy in-memory handoff shape (thin view of the session). */
export type SharedReaderPosition = {
  gameId: string;
  nodeId: string | null;
  fen: string;
  boardFlipped: boolean;
  activeLineNodeIds?: string[];
  updatedAt: number;
};

export type SharedGameSessionInput = Omit<SharedGameSession, 'updatedAt' | 'version'> & {
  version?: typeof SHARED_GAME_SESSION_VERSION;
  updatedAt?: number;
};

let memorySession: SharedGameSession | null = null;
let storage: KeyValueStorage = defaultKeyValueStorage;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingSession: SharedGameSession | null = null;
let debounceMs = SHARED_GAME_SESSION_DEBOUNCE_MS;

/** Test helper — inject memory storage and reset caches. */
export function __setSharedGameSessionStorageForTests(
  next: KeyValueStorage,
  options?: { debounceMs?: number },
): void {
  storage = next;
  if (options?.debounceMs != null) debounceMs = options.debounceMs;
  memorySession = null;
  pendingSession = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}

export function __resetSharedGameSessionForTests(): void {
  memorySession = null;
  pendingSession = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  storage = defaultKeyValueStorage;
  debounceMs = SHARED_GAME_SESSION_DEBOUNCE_MS;
}

function isReaderGame(value: unknown): value is ReaderGame {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.initialFen === 'string' &&
    Array.isArray(g.moves) &&
    typeof g.nodesById === 'object' &&
    g.nodesById != null &&
    !Array.isArray(g.nodesById) &&
    Array.isArray(g.rootIds) &&
    typeof g.hasVariations === 'boolean' &&
    typeof g.headers === 'object' &&
    g.headers != null
  );
}

export function validateSharedGameSession(
  raw: unknown,
): SharedGameSession | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== SHARED_GAME_SESSION_VERSION) return null;
  if (typeof o.gameId !== 'string' || o.gameId.length === 0) return null;
  if (!isReaderGame(o.game)) return null;
  if (o.currentNodeId != null && typeof o.currentNodeId !== 'string') return null;
  if (!Array.isArray(o.activeLineNodeIds)) return null;
  if (!o.activeLineNodeIds.every((id) => typeof id === 'string')) return null;
  if (typeof o.boardFlipped !== 'boolean') return null;
  if (
    o.explorationOriginNodeId != null &&
    typeof o.explorationOriginNodeId !== 'string'
  ) {
    return null;
  }
  if (typeof o.updatedAt !== 'number') return null;

  let analysisProfileId: SharedGameSession['analysisProfileId'];
  if (
    o.analysisProfileId === 'fast' ||
    o.analysisProfileId === 'normal' ||
    o.analysisProfileId === 'deep'
  ) {
    analysisProfileId = o.analysisProfileId;
  }

  let analysisCacheSummary: SharedAnalysisCacheSummary | undefined;
  if (o.analysisCacheSummary && typeof o.analysisCacheSummary === 'object') {
    const s = o.analysisCacheSummary as Record<string, unknown>;
    if (typeof s.analyzedNodeCount === 'number') {
      analysisCacheSummary = {
        analyzedNodeCount: s.analyzedNodeCount,
        lastFen: typeof s.lastFen === 'string' ? s.lastFen : undefined,
        profileId: typeof s.profileId === 'string' ? s.profileId : undefined,
      };
    }
  }

  return {
    version: SHARED_GAME_SESSION_VERSION,
    gameId: o.gameId,
    game: o.game,
    currentNodeId: (o.currentNodeId as string | null) ?? null,
    activeLineNodeIds: o.activeLineNodeIds as string[],
    boardFlipped: o.boardFlipped,
    explorationOriginNodeId:
      (o.explorationOriginNodeId as string | null) ?? null,
    analysisProfileId,
    analysisCacheSummary,
    updatedAt: o.updatedAt,
  };
}

function toSession(input: SharedGameSessionInput): SharedGameSession {
  return {
    version: SHARED_GAME_SESSION_VERSION,
    gameId: input.gameId,
    game: input.game,
    currentNodeId: input.currentNodeId,
    activeLineNodeIds: input.activeLineNodeIds,
    boardFlipped: input.boardFlipped,
    explorationOriginNodeId: input.explorationOriginNodeId,
    analysisProfileId: input.analysisProfileId,
    analysisCacheSummary: input.analysisCacheSummary,
    updatedAt: input.updatedAt ?? Date.now(),
  };
}

function positionFromSession(session: SharedGameSession): SharedReaderPosition {
  const fen =
    session.currentNodeId && session.game.nodesById[session.currentNodeId]
      ? session.game.nodesById[session.currentNodeId]!.fenAfter
      : session.game.initialFen;
  return {
    gameId: session.gameId,
    nodeId: session.currentNodeId,
    fen,
    boardFlipped: session.boardFlipped,
    activeLineNodeIds: session.activeLineNodeIds,
    updatedAt: session.updatedAt,
  };
}

async function writeSession(session: SharedGameSession): Promise<void> {
  // Targeted key write only — never AsyncStorage.clear().
  await storage.setItem(SHARED_GAME_SESSION_STORAGE_KEY, JSON.stringify(session));
}

/**
 * Persist immediately (also updates in-memory cache).
 * Prefer `scheduleSaveSharedGameSession` for UI selection/tree autosave.
 */
export async function saveSharedGameSession(
  input: SharedGameSessionInput,
): Promise<SharedGameSession> {
  const session = toSession(input);
  memorySession = session;
  pendingSession = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeSession(session);
  return session;
}

/**
 * Debounced autosave for selection / tree mutations.
 * Safe to call on every navigation tick — coalesces writes.
 * Do not call from Stockfish UCI handlers.
 */
export function scheduleSaveSharedGameSession(
  input: SharedGameSessionInput,
): SharedGameSession {
  const session = toSession(input);
  memorySession = session;
  pendingSession = session;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const toWrite = pendingSession;
    pendingSession = null;
    if (!toWrite) return;
    void writeSession(toWrite).catch(() => {
      /* persistence is best-effort */
    });
  }, debounceMs);
  return session;
}

/** Flush any pending debounced write (e.g. before leaving the screen). */
export async function flushSharedGameSession(): Promise<SharedGameSession | null> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (pendingSession) {
    const session = pendingSession;
    pendingSession = null;
    memorySession = session;
    await writeSession(session);
    return session;
  }
  return memorySession;
}

export async function loadSharedGameSession(
  gameId?: string,
): Promise<SharedGameSession | null> {
  if (memorySession && (!gameId || memorySession.gameId === gameId)) {
    return memorySession;
  }

  const result = await loadStoredJson<SharedGameSession | null>(
    storage,
    SHARED_GAME_SESSION_STORAGE_KEY,
    null,
    validateSharedGameSession,
  );

  if (result.status !== 'ok' || !result.value) {
    if (gameId && memorySession?.gameId === gameId) return memorySession;
    return null;
  }

  memorySession = result.value;
  if (gameId && memorySession.gameId !== gameId) return null;
  return memorySession;
}

/** Sync peek of the in-memory session (after load / save). */
export function peekSharedGameSession(
  gameId?: string,
): SharedGameSession | null {
  if (!memorySession) return null;
  if (gameId && memorySession.gameId !== gameId) return null;
  return memorySession;
}

export async function clearSharedGameSession(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  pendingSession = null;
  memorySession = null;
  await storage.removeItem(SHARED_GAME_SESSION_STORAGE_KEY);
}

/**
 * Thin compatibility wrappers — update memory + patch durable session when present.
 * Prefer `saveSharedGameSession` / `loadSharedGameSession` for full restore.
 */
export function saveSharedReaderPosition(
  position: Omit<SharedReaderPosition, 'updatedAt'>,
): SharedReaderPosition {
  const updatedAt = Date.now();
  if (memorySession && memorySession.gameId === position.gameId) {
    const next: SharedGameSession = {
      ...memorySession,
      currentNodeId: position.nodeId,
      activeLineNodeIds:
        position.activeLineNodeIds ?? memorySession.activeLineNodeIds,
      boardFlipped: position.boardFlipped,
      updatedAt,
    };
    scheduleSaveSharedGameSession(next);
    return positionFromSession(next);
  }

  // No full session yet — keep a minimal memory-only handoff via a stub session
  // so loadSharedReaderPosition still works across Lecteur ↔ Analyseur.
  if (memorySession == null) {
    memorySession = {
      version: SHARED_GAME_SESSION_VERSION,
      gameId: position.gameId,
      game: {
        id: position.gameId,
        headers: {},
        initialFen: position.fen,
        moves: [],
        nodesById: {},
        rootIds: [],
        hasVariations: false,
      },
      currentNodeId: position.nodeId,
      activeLineNodeIds: position.activeLineNodeIds ?? [],
      boardFlipped: position.boardFlipped,
      explorationOriginNodeId: null,
      updatedAt,
    };
  }
  return {
    ...position,
    updatedAt,
  };
}

export function loadSharedReaderPosition(
  gameId?: string,
): SharedReaderPosition | null {
  const session = peekSharedGameSession(gameId);
  if (!session) return null;
  return positionFromSession(session);
}

/** Memory-only clear (compat). Use `clearSharedGameSession` to drop the durable key. */
export function clearSharedReaderPosition(): void {
  memorySession = null;
  pendingSession = null;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
}
