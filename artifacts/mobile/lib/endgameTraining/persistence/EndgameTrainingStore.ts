/**
 * Persistence for endgame training v2.
 * Never calls AsyncStorage.clear().
 */
import { StorageKeys } from '../../storage/StorageKeys.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import type { AttemptResult, DefenderColor } from '../domain/types.ts';
import { ENDGAME_TRAINING_POOL } from '../data/pool.generated.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../data/poolMetadata.ts';
import { getPositionById } from '../selection/selectors.ts';
import {
  capHistory,
  defendDrawFavoriteId,
  historyFromAttempt,
  migrateTryAgainToFavorites,
  readFavorites,
  readHistory,
  type DefendDrawFavorite,
  type DefendDrawHistoryAttempt,
} from './defendDrawReview.ts';

export type PositionAttemptStats = {
  positionId: string;
  attemptsFinished: number;
  lastResisted: number | null;
  bestResisted: number | null;
  officialDraw: boolean;
  win30: boolean;
  mastered: boolean;
  lastFinishedAt: string | null;
  /** Recent finished attempts (capped). */
  recent: Array<{
    movesResisted: number;
    outcome: AttemptResult['outcome'];
    finishedAt: string;
  }>;
};

export type EndgameTrainingStoreV2 = {
  version: 2;
  /** Last loaded product pool dataset version — drives stale-id cleanup. */
  datasetVersion: string;
  tryAgainIds: string[];
  /** Positions the user has finished (win or loss) — excluded from Nouvelles Finales. */
  finishedIds: string[];
  statsByPosition: Record<string, PositionAttemptStats>;
  showGauge: boolean;
  recentFamilies: string[];
  recentSignatures: string[];
  /** Last ten finished or interrupted attempts. Not unique positions. */
  history: DefendDrawHistoryAttempt[];
  /** Starred initial positions. Independent of history eviction. */
  favorites: DefendDrawFavorite[];
  /** Favorite ids the user removed. Prevents a sync from restoring them. */
  favoriteTombstones: string[];
  /** id -> ISO time of the removal. A later star can win over an older tombstone. */
  favoriteDeletedAt: Record<string, string>;
  /** Attempt ids already written. Stops a remount from appending a second row. */
  recordedAttemptIds: string[];
  syncDeletedIds?: string[];
  updatedAt?: string;
};

const KEY = StorageKeys.endgameTrainingV2.key;
const MAX_RECENT = 8;

let storage: KeyValueStorage = defaultKeyValueStorage;

/** Inject storage backend (MemoryKeyValueStorage in unit tests). */
export function configureEndgameStoreStorage(next: KeyValueStorage): void {
  storage = next;
  cache = null;
}

export function resetEndgameStoreStorage(): void {
  storage = defaultKeyValueStorage;
  cache = null;
}

function emptyStore(): EndgameTrainingStoreV2 {
  return {
    version: 2,
    datasetVersion: ENDGAME_POOL_DATASET_VERSION,
    tryAgainIds: [],
    finishedIds: [],
    statsByPosition: {},
    showGauge: true,
    recentFamilies: [],
    recentSignatures: [],
    history: [],
    favorites: [],
    favoriteTombstones: [],
    favoriteDeletedAt: {},
    recordedAttemptIds: [],
  };
}

let cache: EndgameTrainingStoreV2 | null = null;

function runtimePoolIds(): Set<string> {
  return new Set(ENDGAME_TRAINING_POOL.map((p) => p.id));
}

/** Drop saved ids that no longer exist in the product pool. Keep attempt stats for history. */
export function sanitizeStoreAgainstPool(
  store: EndgameTrainingStoreV2,
): boolean {
  const poolIds = runtimePoolIds();
  let changed = false;

  const filterKnown = (ids: string[]) => ids.filter((id) => poolIds.has(id));

  const nextTryAgain = filterKnown(store.tryAgainIds);
  if (nextTryAgain.length !== store.tryAgainIds.length) {
    store.tryAgainIds = nextTryAgain;
    changed = true;
  }

  const nextFinished = filterKnown(store.finishedIds);
  if (nextFinished.length !== store.finishedIds.length) {
    store.finishedIds = nextFinished;
    changed = true;
  }

  // Stats, attempt history, and self-contained favorites stay when a pool id disappears.
  if (!Array.isArray(store.history)) store.history = [];
  if (!Array.isArray(store.favorites)) store.favorites = [];
  const nextHistory = capHistory(readHistory(store.history));
  if (nextHistory.length !== store.history.length) {
    store.history = nextHistory;
    changed = true;
  } else {
    store.history = nextHistory;
  }
  store.favorites = readFavorites(store.favorites);
  if (!Array.isArray(store.favoriteTombstones)) store.favoriteTombstones = [];
  if (!store.favoriteDeletedAt || typeof store.favoriteDeletedAt !== 'object') {
    store.favoriteDeletedAt = {};
  }
  if (!Array.isArray(store.recordedAttemptIds)) store.recordedAttemptIds = [];

  if (store.datasetVersion !== ENDGAME_POOL_DATASET_VERSION) {
    store.datasetVersion = ENDGAME_POOL_DATASET_VERSION;
    changed = true;
  }

  return changed;
}

export async function loadEndgameStore(): Promise<EndgameTrainingStoreV2> {
  if (cache) return cache;
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) {
      cache = emptyStore();
      return cache;
    }
    const parsed = JSON.parse(raw) as Partial<EndgameTrainingStoreV2> & {
      favorites?: unknown;
      history?: unknown;
    };
    const hadFavorites = Array.isArray(parsed.favorites);
    const tryAgainIds = Array.isArray(parsed.tryAgainIds) ? parsed.tryAgainIds : [];
    const favorites = hadFavorites
      ? readFavorites(parsed.favorites)
      : migrateTryAgainToFavorites(tryAgainIds, [], (positionId) => {
          const pos = getPositionById(positionId);
          return pos ? { fen: pos.fen, defender: pos.defender } : null;
        });
    cache = {
      ...emptyStore(),
      ...parsed,
      version: 2,
      datasetVersion:
        typeof parsed.datasetVersion === 'string'
          ? parsed.datasetVersion
          : ENDGAME_POOL_DATASET_VERSION,
      tryAgainIds,
      finishedIds: Array.isArray(parsed.finishedIds) ? parsed.finishedIds : [],
      statsByPosition: parsed.statsByPosition ?? {},
      showGauge: parsed.showGauge !== false,
      recentFamilies: parsed.recentFamilies ?? [],
      recentSignatures: parsed.recentSignatures ?? [],
      history: readHistory(parsed.history),
      favorites,
      favoriteTombstones: Array.isArray(parsed.favoriteTombstones)
        ? parsed.favoriteTombstones.filter((id): id is string => typeof id === 'string')
        : [],
      favoriteDeletedAt:
        parsed.favoriteDeletedAt && typeof parsed.favoriteDeletedAt === 'object'
          ? parsed.favoriteDeletedAt
          : {},
      recordedAttemptIds: Array.isArray(parsed.recordedAttemptIds)
        ? parsed.recordedAttemptIds.filter((id): id is string => typeof id === 'string')
        : [],
    };
    const migrated = !hadFavorites && favorites.length > 0;
    const sanitized = sanitizeStoreAgainstPool(cache);
    if (migrated || sanitized) {
      await persist(cache);
    }
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

async function persist(store: EndgameTrainingStoreV2): Promise<void> {
  store.updatedAt = new Date().toISOString();
  cache = store;
  await storage.setItem(KEY, JSON.stringify(store));
}

export async function getShowGauge(): Promise<boolean> {
  const s = await loadEndgameStore();
  return s.showGauge;
}

export async function setShowGauge(show: boolean): Promise<void> {
  const s = await loadEndgameStore();
  s.showGauge = show;
  await persist(s);
}

export async function getTryAgainIds(): Promise<string[]> {
  return (await loadEndgameStore()).tryAgainIds;
}

export async function addToTryAgain(positionId: string): Promise<boolean> {
  const s = await loadEndgameStore();
  if (s.tryAgainIds.includes(positionId)) return false;
  s.tryAgainIds = [positionId, ...s.tryAgainIds];
  await persist(s);
  return true;
}

export async function removeFromTryAgain(positionId: string): Promise<void> {
  const s = await loadEndgameStore();
  s.tryAgainIds = s.tryAgainIds.filter((id) => id !== positionId);
  await persist(s);
}

export async function isInTryAgain(positionId: string): Promise<boolean> {
  return (await loadEndgameStore()).tryAgainIds.includes(positionId);
}

export async function listDefendDrawHistory(): Promise<DefendDrawHistoryAttempt[]> {
  return (await loadEndgameStore()).history;
}

export async function getDefendDrawHistoryAttempt(
  attemptId: string,
): Promise<DefendDrawHistoryAttempt | null> {
  return (await loadEndgameStore()).history.find((row) => row.id === attemptId) ?? null;
}

export async function listDefendDrawFavorites(): Promise<DefendDrawFavorite[]> {
  return (await loadEndgameStore()).favorites;
}

export async function isDefendDrawStarred(
  positionId: string,
  playerColor: DefenderColor,
  initialFen: string,
): Promise<boolean> {
  const id = defendDrawFavoriteId(positionId, playerColor, initialFen);
  return (await loadEndgameStore()).favorites.some((favorite) => favorite.id === id);
}

/** Star the initial position. A second star of the same position is a no-op. */
export async function starDefendDrawPosition(input: {
  positionId: string;
  playerColor: DefenderColor;
  initialFen: string;
}): Promise<DefendDrawFavorite> {
  const s = await loadEndgameStore();
  const id = defendDrawFavoriteId(input.positionId, input.playerColor, input.initialFen);
  delete s.favoriteDeletedAt[id];
  s.favoriteTombstones = s.favoriteTombstones.filter((item) => item !== id);
  s.syncDeletedIds = (s.syncDeletedIds ?? []).filter((item) => item !== id);
  const existing = s.favorites.find((favorite) => favorite.id === id);
  if (existing) {
    await persist(s);
    return existing;
  }
  const favorite: DefendDrawFavorite = {
    id,
    positionId: input.positionId,
    initialFen: input.initialFen,
    playerColor: input.playerColor,
    sideToMove: input.initialFen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w',
    starredAt: new Date().toISOString(),
  };
  s.favorites = [favorite, ...s.favorites];
  if (!s.tryAgainIds.includes(input.positionId)) {
    s.tryAgainIds = [input.positionId, ...s.tryAgainIds];
  }
  await persist(s);
  return favorite;
}

/** Drop the favorite only. History and the active session are left untouched. */
export async function unstarDefendDrawPosition(input: {
  positionId: string;
  playerColor: DefenderColor;
  initialFen: string;
}): Promise<void> {
  const s = await loadEndgameStore();
  const id = defendDrawFavoriteId(input.positionId, input.playerColor, input.initialFen);
  s.favorites = s.favorites.filter((favorite) => favorite.id !== id);
  if (!s.favoriteTombstones.includes(id)) s.favoriteTombstones = [...s.favoriteTombstones, id];
  s.favoriteDeletedAt[id] = new Date().toISOString();
  s.syncDeletedIds = [...new Set([...(s.syncDeletedIds ?? []), id])];
  s.tryAgainIds = s.tryAgainIds.filter((item) => item !== input.positionId);
  await persist(s);
}

/**
 * Record a finished or interrupted attempt.
 * In-progress is ignored. The same attempt id is written once.
 * A starred position is not removed when the exercise is mastered.
 */
export async function recordFinishedAttempt(
  result: AttemptResult,
  meta?: { family?: string; materialSignature?: string },
): Promise<PositionAttemptStats> {
  const s = await loadEndgameStore();
  const emptyStats = (): PositionAttemptStats =>
    s.statsByPosition[result.positionId] ?? {
      positionId: result.positionId,
      attemptsFinished: 0,
      lastResisted: null,
      bestResisted: null,
      officialDraw: false,
      win30: false,
      mastered: false,
      lastFinishedAt: null,
      recent: [],
    };

  if (result.outcome === 'in-progress') return emptyStats();
  if (result.attemptId && s.recordedAttemptIds.includes(result.attemptId)) {
    return emptyStats();
  }

  const playerColor: DefenderColor =
    result.positionSnapshot?.playerColor ??
    (result.startFen.split(/\s+/)[1] === 'b' ? 'black' : 'white');
  const historyRow = historyFromAttempt(
    result,
    getPositionById(result.positionId)?.defender ?? playerColor,
  );
  if (historyRow) {
    s.history = capHistory([historyRow, ...s.history.filter((row) => row.id !== historyRow.id)]);
  }
  if (result.attemptId) {
    s.recordedAttemptIds = [result.attemptId, ...s.recordedAttemptIds.filter((id) => id !== result.attemptId)].slice(0, 200);
  }

  if (result.outcome === 'abandoned') {
    await persist(s);
    return emptyStats();
  }

  if (!s.finishedIds.includes(result.positionId)) {
    s.finishedIds = [result.positionId, ...s.finishedIds];
  }

  const prev = s.statsByPosition[result.positionId] ?? {
    positionId: result.positionId,
    attemptsFinished: 0,
    lastResisted: null,
    bestResisted: null,
    officialDraw: false,
    win30: false,
    mastered: false,
    lastFinishedAt: null,
    recent: [],
  };

  const mastered =
    result.outcome === 'win-30-moves' || result.outcome === 'win-official-draw';

  const next: PositionAttemptStats = {
    ...prev,
    attemptsFinished: prev.attemptsFinished + 1,
    lastResisted: result.movesResisted,
    bestResisted: Math.max(prev.bestResisted ?? 0, result.movesResisted),
    officialDraw: prev.officialDraw || result.outcome === 'win-official-draw',
    win30: prev.win30 || result.outcome === 'win-30-moves',
    mastered: prev.mastered || mastered,
    lastFinishedAt: result.finishedAt,
    recent: [
      {
        movesResisted: result.movesResisted,
        outcome: result.outcome,
        finishedAt: result.finishedAt,
      },
      ...prev.recent,
    ].slice(0, MAX_RECENT),
  };
  s.statsByPosition[result.positionId] = next;

  if (meta?.family) {
    s.recentFamilies = [meta.family, ...s.recentFamilies].slice(0, 8);
  }
  if (meta?.materialSignature) {
    s.recentSignatures = [meta.materialSignature, ...s.recentSignatures].slice(0, 8);
  }

  await persist(s);
  return next;
}

export async function getPositionStats(
  positionId: string,
): Promise<PositionAttemptStats | null> {
  const s = await loadEndgameStore();
  return s.statsByPosition[positionId] ?? null;
}

export async function getFinishedIds(): Promise<Set<string>> {
  return new Set((await loadEndgameStore()).finishedIds);
}

export async function getVarietyContext(): Promise<{
  recentFamilies: string[];
  recentSignatures: string[];
}> {
  const s = await loadEndgameStore();
  return {
    recentFamilies: s.recentFamilies,
    recentSignatures: s.recentSignatures,
  };
}

export function clearEndgameStoreCache(): void {
  cache = null;
}
