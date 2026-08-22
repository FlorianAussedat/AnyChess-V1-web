/**
 * Persistence for endgame training v2.
 * Never calls AsyncStorage.clear().
 */
import { StorageKeys } from '../../storage/StorageKeys.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import type { AttemptResult } from '../domain/types.ts';
import { ENDGAME_TRAINING_POOL } from '../data/pool.generated.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../data/poolMetadata.ts';

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
  };
}

let cache: EndgameTrainingStoreV2 | null = null;

function runtimePoolIds(): Set<string> {
  return new Set(ENDGAME_TRAINING_POOL.map((p) => p.id));
}

/** Drop saved ids that no longer exist in the product pool. */
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

  for (const id of Object.keys(store.statsByPosition)) {
    if (!poolIds.has(id)) {
      delete store.statsByPosition[id];
      changed = true;
    }
  }

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
    const parsed = JSON.parse(raw) as Partial<EndgameTrainingStoreV2>;
    cache = {
      ...emptyStore(),
      ...parsed,
      version: 2,
      datasetVersion:
        typeof parsed.datasetVersion === 'string'
          ? parsed.datasetVersion
          : ENDGAME_POOL_DATASET_VERSION,
      tryAgainIds: Array.isArray(parsed.tryAgainIds) ? parsed.tryAgainIds : [],
      finishedIds: Array.isArray(parsed.finishedIds) ? parsed.finishedIds : [],
      statsByPosition: parsed.statsByPosition ?? {},
      showGauge: parsed.showGauge !== false,
      recentFamilies: parsed.recentFamilies ?? [],
      recentSignatures: parsed.recentSignatures ?? [],
    };
    if (sanitizeStoreAgainstPool(cache)) {
      await persist(cache);
    }
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

async function persist(store: EndgameTrainingStoreV2): Promise<void> {
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

/**
 * Record a finished attempt (win or loss). Abandon must NOT call this.
 * Mastery (win-30 or official draw) auto-removes from Try Again.
 */
export async function recordFinishedAttempt(
  result: AttemptResult,
  meta?: { family?: string; materialSignature?: string },
): Promise<PositionAttemptStats> {
  const s = await loadEndgameStore();
  if (result.outcome === 'abandoned' || result.outcome === 'in-progress') {
    return (
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
      }
    );
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

  if (mastered) {
    s.tryAgainIds = s.tryAgainIds.filter((id) => id !== result.positionId);
  }

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
