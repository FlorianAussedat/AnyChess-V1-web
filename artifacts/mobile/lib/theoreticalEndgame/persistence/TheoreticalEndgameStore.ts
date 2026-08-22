/**
 * Persistence for theoretical endgame training v1.
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
import { scoreAttempt, averageComprehensionScore } from '../domain/comprehensionScore.ts';

export type ThemeAttemptRecord = {
  positionId: string;
  themeId: TheoreticalThemeId;
  outcome: AttemptOutcome;
  userMoves: number;
  targetUserMoves: number;
  attemptScore: number;
  finishedAt: string;
};

export type TheoreticalEndgameStoreV1 = {
  version: 1;
  catalogView: CatalogViewMode;
  themeAttempts: Record<string, ThemeAttemptRecord[]>;
  lastPositionByTheme: Record<string, string>;
  bestByPosition: Record<string, { userMoves: number; attemptScore: number }>;
};

const KEY = StorageKeys.theoreticalEndgameV1.key;
const MAX_ATTEMPTS_PER_THEME = 20;

let storage: KeyValueStorage = defaultKeyValueStorage;
let cache: TheoreticalEndgameStoreV1 | null = null;

export function configureTheoreticalStoreStorage(s: KeyValueStorage): void {
  storage = s;
  cache = null;
}

function emptyStore(): TheoreticalEndgameStoreV1 {
  return {
    version: 1,
    catalogView: 'cards',
    themeAttempts: {},
    lastPositionByTheme: {},
    bestByPosition: {},
  };
}

export async function loadTheoreticalStore(): Promise<TheoreticalEndgameStoreV1> {
  if (cache) return cache;
  try {
    const raw = await storage.getItem(KEY);
    if (!raw) {
      cache = emptyStore();
      return cache;
    }
    const parsed = JSON.parse(raw) as Partial<TheoreticalEndgameStoreV1>;
    cache = {
      ...emptyStore(),
      ...parsed,
      version: 1,
      catalogView: parsed.catalogView === 'list' ? 'list' : 'cards',
      themeAttempts: parsed.themeAttempts ?? {},
      lastPositionByTheme: parsed.lastPositionByTheme ?? {},
      bestByPosition: parsed.bestByPosition ?? {},
    };
    return cache;
  } catch {
    cache = emptyStore();
    return cache;
  }
}

async function persist(store: TheoreticalEndgameStoreV1): Promise<void> {
  cache = store;
  await storage.setItem(KEY, JSON.stringify(store));
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
