/**
 * Persistence for theoretical endgame training.
 * v2 resets attempt history tied to the old 44-position dataset while keeping
 * catalogView and never touching unrelated storage keys.
 */
import { StorageKeys } from '../../storage/StorageKeys.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import type {
  AttemptOutcome,
  CatalogViewMode,
  TheoreticalAttemptResult,
  TheoreticalThemeId,
} from '../domain/types.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../domain/types.ts';
import { scoreAttempt, averageComprehensionScore } from '../domain/comprehensionScore.ts';
import { LEGACY_THEORETICAL_IDS } from '../domain/fenLegality.ts';
import { getPositionById } from '../selection/selectors.ts';

export type ThemeAttemptRecord = {
  positionId: string;
  themeId: TheoreticalThemeId;
  outcome: AttemptOutcome;
  userMoves: number;
  targetUserMoves: number;
  attemptScore: number;
  finishedAt: string;
};

export type TheoreticalEndgameStoreV2 = {
  version: 2;
  datasetVersion: string;
  contentVersion: string;
  catalogView: CatalogViewMode;
  themeAttempts: Record<string, ThemeAttemptRecord[]>;
  lastPositionByTheme: Record<string, string>;
  bestByPosition: Record<string, { userMoves: number; attemptScore: number }>;
  /** @deprecated kept only during migration sniffing */
  migratedFromV1?: boolean;
};

/** @deprecated */
export type TheoreticalEndgameStoreV1 = {
  version: 1;
  catalogView: CatalogViewMode;
  themeAttempts: Record<string, ThemeAttemptRecord[]>;
  lastPositionByTheme: Record<string, string>;
  bestByPosition: Record<string, { userMoves: number; attemptScore: number }>;
};

const KEY_V1 = StorageKeys.theoreticalEndgameV1.key;
const KEY_V2 = StorageKeys.theoreticalEndgameV2.key;
const MAX_ATTEMPTS_PER_THEME = 20;
const LEGACY_ID_SET = new Set(LEGACY_THEORETICAL_IDS);

let storage: KeyValueStorage = defaultKeyValueStorage;
let cache: TheoreticalEndgameStoreV2 | null = null;

export function configureTheoreticalStoreStorage(s: KeyValueStorage): void {
  storage = s;
  cache = null;
}

function emptyStore(): TheoreticalEndgameStoreV2 {
  return {
    version: 2,
    datasetVersion: THEORETICAL_ENDGAME_CONFIG.datasetVersion,
    contentVersion: THEORETICAL_ENDGAME_CONFIG.contentVersion,
    catalogView: 'cards',
    themeAttempts: {},
    lastPositionByTheme: {},
    bestByPosition: {},
  };
}

function isLegacyPositionId(id: string): boolean {
  return LEGACY_ID_SET.has(id) || (!id.startsWith('TE-CANON-') && /^TE-\d{3}$/.test(id));
}

function scrubLegacyAttempts(
  themeAttempts: Record<string, ThemeAttemptRecord[]>,
): Record<string, ThemeAttemptRecord[]> {
  const out: Record<string, ThemeAttemptRecord[]> = {};
  for (const [themeId, attempts] of Object.entries(themeAttempts)) {
    if (themeId === 'three-pawns') continue;
    const kept = (attempts ?? []).filter((a) => !isLegacyPositionId(a.positionId));
    if (kept.length > 0) out[themeId] = kept;
  }
  return out;
}

function scrubLastPositions(
  last: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [themeId, positionId] of Object.entries(last)) {
    if (themeId === 'three-pawns') continue;
    if (isLegacyPositionId(positionId)) continue;
    if (!getPositionById(positionId)) continue;
    out[themeId] = positionId;
  }
  return out;
}

function scrubBest(
  best: Record<string, { userMoves: number; attemptScore: number }>,
): Record<string, { userMoves: number; attemptScore: number }> {
  const out: Record<string, { userMoves: number; attemptScore: number }> = {};
  for (const [positionId, value] of Object.entries(best)) {
    if (isLegacyPositionId(positionId)) continue;
    if (!getPositionById(positionId)) continue;
    out[positionId] = value;
  }
  return out;
}

/**
 * Migrate v1 → v2: keep catalogView, drop attempts/scores tied to legacy IDs.
 * Idempotent.
 */
export function migrateTheoreticalStore(raw: unknown): TheoreticalEndgameStoreV2 {
  const base = emptyStore();
  if (!raw || typeof raw !== 'object') return base;

  const parsed = raw as Record<string, unknown>;
  const catalogView = parsed.catalogView === 'list' ? 'list' : 'cards';
  const version = parsed.version;
  const datasetVersion =
    typeof parsed.datasetVersion === 'string' ? parsed.datasetVersion : '';
  const themeAttempts =
    (parsed.themeAttempts as Record<string, ThemeAttemptRecord[]> | undefined) ?? {};
  const lastPositionByTheme =
    (parsed.lastPositionByTheme as Record<string, string> | undefined) ?? {};
  const bestByPosition =
    (parsed.bestByPosition as
      | Record<string, { userMoves: number; attemptScore: number }>
      | undefined) ?? {};

  if (version === 2 && datasetVersion === THEORETICAL_ENDGAME_CONFIG.datasetVersion) {
    return {
      ...base,
      catalogView,
      themeAttempts: scrubLegacyAttempts(themeAttempts),
      lastPositionByTheme: scrubLastPositions(lastPositionByTheme),
      bestByPosition: scrubBest(bestByPosition),
      migratedFromV1: parsed.migratedFromV1 === true,
    };
  }

  // v1 or unknown → reset theoretical progress, keep catalog preference
  return {
    ...base,
    catalogView,
    themeAttempts: {},
    lastPositionByTheme: {},
    bestByPosition: {},
    migratedFromV1: version === 1,
  };
}

export async function loadTheoreticalStore(): Promise<TheoreticalEndgameStoreV2> {
  if (cache) return cache;
  try {
    const rawV2 = await storage.getItem(KEY_V2);
    if (rawV2) {
      const migrated = migrateTheoreticalStore(JSON.parse(rawV2));
      cache = migrated;
      await persist(migrated);
      return cache;
    }

    const rawV1 = await storage.getItem(KEY_V1);
    if (rawV1) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(rawV1);
      } catch {
        parsed = null;
      }
      const migrated = migrateTheoreticalStore(parsed);
      cache = migrated;
      await persist(migrated);
      return cache;
    }

    cache = emptyStore();
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

async function persist(store: TheoreticalEndgameStoreV2): Promise<void> {
  cache = store;
  await storage.setItem(KEY_V2, JSON.stringify(store));
}

export async function getCatalogView(): Promise<CatalogViewMode> {
  return (await loadTheoreticalStore()).catalogView;
}

export async function setCatalogView(view: CatalogViewMode): Promise<void> {
  const s = await loadTheoreticalStore();
  s.catalogView = view;
  await persist(s);
}

export async function getThemeAttempts(
  themeId: TheoreticalThemeId,
): Promise<ThemeAttemptRecord[]> {
  const s = await loadTheoreticalStore();
  return s.themeAttempts[themeId] ?? [];
}

export async function getThemeComprehension(themeId: TheoreticalThemeId): Promise<{
  score: number;
  count: number;
}> {
  const attempts = await getThemeAttempts(themeId);
  return averageComprehensionScore(attempts);
}

export async function getLastPositionId(themeId: TheoreticalThemeId): Promise<string | null> {
  const s = await loadTheoreticalStore();
  return s.lastPositionByTheme[themeId] ?? null;
}

export async function recordAttempt(
  result: TheoreticalAttemptResult,
): Promise<{ oldScore: number; newScore: number; count: number }> {
  if (result.outcome === 'abandoned' || result.outcome === 'in-progress') {
    const { score, count } = await getThemeComprehension(result.themeId);
    return { oldScore: score, newScore: score, count };
  }

  const s = await loadTheoreticalStore();
  const prev = s.themeAttempts[result.themeId] ?? [];
  const { score: oldScore } = averageComprehensionScore(prev);

  const record: ThemeAttemptRecord = {
    positionId: result.positionId,
    themeId: result.themeId,
    outcome: result.outcome,
    userMoves: result.userMoves,
    targetUserMoves: result.targetUserMoves,
    attemptScore: result.attemptScore,
    finishedAt: result.finishedAt,
  };

  s.themeAttempts[result.themeId] = [record, ...prev].slice(0, MAX_ATTEMPTS_PER_THEME);
  s.lastPositionByTheme[result.themeId] = result.positionId;

  const best = s.bestByPosition[result.positionId];
  if (
    !best ||
    (result.outcome === 'success' && result.attemptScore > best.attemptScore) ||
    (result.outcome === 'success' &&
      result.attemptScore === best.attemptScore &&
      result.userMoves < best.userMoves)
  ) {
    s.bestByPosition[result.positionId] = {
      userMoves: result.userMoves,
      attemptScore: result.attemptScore,
    };
  }

  await persist(s);
  const { score: newScore, count } = averageComprehensionScore(s.themeAttempts[result.themeId]!);
  return { oldScore, newScore, count };
}

export async function getAllThemeScores(): Promise<
  Record<string, { score: number; count: number }>
> {
  const s = await loadTheoreticalStore();
  const out: Record<string, { score: number; count: number }> = {};
  for (const themeId of Object.keys(s.themeAttempts)) {
    out[themeId] = averageComprehensionScore(s.themeAttempts[themeId] ?? []);
  }
  return out;
}

export function clearTheoreticalStoreCache(): void {
  cache = null;
}

export { scoreAttempt };
