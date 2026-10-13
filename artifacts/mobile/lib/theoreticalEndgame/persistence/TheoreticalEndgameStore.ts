/**
 * Persistence for theoretical endgame training.
 * v2 resets attempt history tied to the old 44-position dataset while keeping
 * catalogView and never touching unrelated storage keys.
 */
import { StorageKeys } from '../../storage/StorageKeys.ts';
import type { KeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../../storage/AsyncKeyValueStorage.ts';
import type {
  AnalysisStatus,
  AttemptOutcome,
  CatalogViewMode,
  GradeCause,
  GradeConfidence,
  MeasuredDecision,
  PlayerColor,
  ScoreScaleId,
  TheoreticalAttemptResult,
  TheoreticalObjective,
  TheoreticalThemeId,
} from '../domain/types.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../domain/types.ts';
import {
  scoreAttempt,
  averageLegacyScore,
  summarizeAttempts,
  type ThemeScoreSummary,
} from '../domain/comprehensionScore.ts';
import { LEGACY_THEORETICAL_IDS } from '../domain/fenLegality.ts';
import { getPositionById } from '../selection/selectors.ts';

export type ThemeAttemptRecord = {
  positionId: string;
  themeId: TheoreticalThemeId;
  outcome: AttemptOutcome;
  userMoves: number;
  /** legacy-10 keeps the historical ratio. Never averaged with quality-5. */
  scoreScale: ScoreScaleId;
  attemptScore: number | null;
  finishedAt: string;
  durationMs?: number;
  startFen?: string;
  playerColor?: PlayerColor;
  moveSans?: string[];
  /** Position id, or the catalog variant group when the position has one. */
  variantGroup?: string;
  objective?: TheoreticalObjective;
  analysisStatus?: AnalysisStatus;
  gradeConfidence?: GradeConfidence;
  gradeCause?: GradeCause | null;
  gradeProtocol?: 'exact' | 'engine' | null;
  measuredDecisions?: MeasuredDecision[];
  /** Next decision index. Earlier decisions are already measured. */
  gradeCursor?: number;
  /** Current complementary-search budget, persisted so a retry continues. */
  gradeBudgetMs?: number;
  /** Index into the progressive budget steps. */
  gradeStepIndex?: number;
  /** Total analysis budget for this attempt, kept across resumes. */
  gradeDeadlineMs?: number;
  /** Wall time already spent grading this attempt. */
  gradeConsumedMs?: number;
};

const ANALYSIS_STATUSES: readonly AnalysisStatus[] = [
  'not-needed',
  'pending',
  'running',
  'scored',
  'estimated',
  'failed',
];

export type TheoreticalEndgameStoreV2 = {
  version: 2;
  datasetVersion: string;
  contentVersion: string;
  catalogView: CatalogViewMode;
  themeAttempts: Record<string, ThemeAttemptRecord[]>;
  lastPositionByTheme: Record<string, string>;
  bestByPosition: Record<string, { userMoves: number; attemptScore: number; scoreScale: 'quality-5' }>;
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

function asStatus(value: unknown, outcome: AttemptOutcome, score: number | null, confidence: GradeConfidence): AnalysisStatus {
  if (value === 'running') return 'pending';
  if (typeof value === 'string' && ANALYSIS_STATUSES.includes(value as AnalysisStatus)) {
    return value as AnalysisStatus;
  }
  if (outcome === 'theoretical-loss') return 'not-needed';
  if (outcome === 'success' && typeof score === 'number') {
    return confidence === 'estimated' ? 'estimated' : 'scored';
  }
  if (outcome === 'success') return 'pending';
  return 'not-needed';
}

function asDecisions(value: unknown): MeasuredDecision[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out: MeasuredDecision[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.fenBefore !== 'string' || typeof row.fenAfter !== 'string') continue;
    out.push({
      fenBefore: row.fenBefore,
      san: typeof row.san === 'string' ? row.san : '',
      fenAfter: row.fenAfter,
      dtmBefore: typeof row.dtmBefore === 'number' ? row.dtmBefore : null,
      dtmAfter: typeof row.dtmAfter === 'number' ? row.dtmAfter : null,
      beforeSource:
        row.beforeSource === 'exact' || row.beforeSource === 'engine' || row.beforeSource === 'observed'
          ? row.beforeSource
          : null,
      afterSource:
        row.afterSource === 'exact' || row.afterSource === 'engine' || row.afterSource === 'observed'
          ? row.afterSource
          : null,
      resultAfterReply:
        row.resultAfterReply === 'WIN' || row.resultAfterReply === 'DRAW' || row.resultAfterReply === 'LOSS'
          ? row.resultAfterReply
          : row.resultAfterReply === null
            ? null
            : undefined,
    });
  }
  return out;
}

function normalizeAttempt(raw: Record<string, unknown>): ThemeAttemptRecord | null {
  const positionId = typeof raw.positionId === 'string' ? raw.positionId : '';
  const themeId = raw.themeId as TheoreticalThemeId;
  if (!positionId || !themeId || isLegacyPositionId(positionId)) return null;
  const scale: ScoreScaleId = raw.scoreScale === 'quality-5' ? 'quality-5' : 'legacy-10';
  const outcome = (raw.outcome as AttemptOutcome) ?? 'success';
  const attemptScore = typeof raw.attemptScore === 'number' ? raw.attemptScore : null;
  const gradeConfidence: GradeConfidence =
    raw.gradeConfidence === 'exact' || raw.gradeConfidence === 'estimated' ? raw.gradeConfidence : null;
  return {
    positionId,
    themeId,
    outcome,
    userMoves: typeof raw.userMoves === 'number' ? raw.userMoves : 0,
    scoreScale: scale,
    attemptScore,
    finishedAt: typeof raw.finishedAt === 'string' ? raw.finishedAt : '',
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : undefined,
    startFen: typeof raw.startFen === 'string' ? raw.startFen : undefined,
    playerColor: raw.playerColor === 'white' || raw.playerColor === 'black' ? raw.playerColor : undefined,
    moveSans: Array.isArray(raw.moveSans) ? raw.moveSans.filter((san): san is string => typeof san === 'string') : undefined,
    variantGroup: typeof raw.variantGroup === 'string' ? raw.variantGroup : undefined,
    objective: raw.objective === 'WIN' || raw.objective === 'DRAW' ? raw.objective : undefined,
    analysisStatus: asStatus(raw.analysisStatus, outcome, attemptScore, gradeConfidence),
    gradeConfidence,
    gradeCause: typeof raw.gradeCause === 'string' ? (raw.gradeCause as GradeCause) : null,
    gradeProtocol: raw.gradeProtocol === 'exact' || raw.gradeProtocol === 'engine' ? raw.gradeProtocol : null,
    measuredDecisions: asDecisions(raw.measuredDecisions),
    gradeCursor: typeof raw.gradeCursor === 'number' ? raw.gradeCursor : undefined,
    gradeBudgetMs: typeof raw.gradeBudgetMs === 'number' ? raw.gradeBudgetMs : undefined,
    gradeStepIndex: typeof raw.gradeStepIndex === 'number' ? raw.gradeStepIndex : undefined,
    gradeDeadlineMs: typeof raw.gradeDeadlineMs === 'number' ? raw.gradeDeadlineMs : undefined,
    gradeConsumedMs: typeof raw.gradeConsumedMs === 'number' ? raw.gradeConsumedMs : undefined,
  };
}

function scrubLegacyAttempts(
  themeAttempts: Record<string, unknown>,
): Record<string, ThemeAttemptRecord[]> {
  const out: Record<string, ThemeAttemptRecord[]> = {};
  for (const [themeId, attempts] of Object.entries(themeAttempts)) {
    if (themeId === 'three-pawns') continue;
    const kept = (Array.isArray(attempts) ? attempts : [])
      .map((a) => normalizeAttempt((a ?? {}) as Record<string, unknown>))
      .filter((a): a is ThemeAttemptRecord => a != null);
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
  best: Record<string, { userMoves?: number; attemptScore?: number; scoreScale?: string }>,
): Record<string, { userMoves: number; attemptScore: number; scoreScale: 'quality-5' }> {
  const out: Record<string, { userMoves: number; attemptScore: number; scoreScale: 'quality-5' }> = {};
  for (const [positionId, value] of Object.entries(best)) {
    if (isLegacyPositionId(positionId)) continue;
    if (!getPositionById(positionId)) continue;
    if (value?.scoreScale !== 'quality-5' || typeof value.attemptScore !== 'number') continue;
    out[positionId] = {
      userMoves: value.userMoves ?? 0,
      attemptScore: value.attemptScore,
      scoreScale: 'quality-5',
    };
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
  const themeAttempts = (parsed.themeAttempts as Record<string, unknown> | undefined) ?? {};
  const lastPositionByTheme =
    (parsed.lastPositionByTheme as Record<string, string> | undefined) ?? {};
  const bestByPosition =
    (parsed.bestByPosition as
      | Record<string, { userMoves?: number; attemptScore?: number; scoreScale?: string }>
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

export async function getThemeComprehension(themeId: TheoreticalThemeId): Promise<ThemeScoreSummary> {
  const attempts = await getThemeAttempts(themeId);
  return summarizeAttempts(attempts);
}

export async function getLastPositionId(themeId: TheoreticalThemeId): Promise<string | null> {
  const s = await loadTheoreticalStore();
  return s.lastPositionByTheme[themeId] ?? null;
}

export type RecordedAttemptDelta = ThemeScoreSummary & {
  oldScore: number;
  newScore: number;
  attemptScore: number | null;
  analysisStatus: AnalysisStatus;
  gradeConfidence: GradeConfidence;
};

function emptyDelta(summary: ThemeScoreSummary): RecordedAttemptDelta {
  return {
    ...summary,
    oldScore: summary.score,
    newScore: summary.score,
    attemptScore: null,
    analysisStatus: 'not-needed',
    gradeConfidence: null,
  };
}

function rememberBest(store: TheoreticalEndgameStoreV2, record: ThemeAttemptRecord): void {
  const graded =
    record.scoreScale === 'quality-5' &&
    record.outcome === 'success' &&
    record.gradeConfidence !== 'estimated' &&
    typeof record.attemptScore === 'number';
  if (!graded) return;
  const best = store.bestByPosition[record.positionId];
  if (
    !best ||
    record.attemptScore! > best.attemptScore ||
    (record.attemptScore === best.attemptScore && record.userMoves < best.userMoves)
  ) {
    store.bestByPosition[record.positionId] = {
      userMoves: record.userMoves,
      attemptScore: record.attemptScore!,
      scoreScale: 'quality-5',
    };
  }
}

export async function recordAttempt(result: TheoreticalAttemptResult): Promise<RecordedAttemptDelta> {
  const s0 = await loadTheoreticalStore();
  const current = summarizeAttempts(s0.themeAttempts[result.themeId] ?? []);
  if (
    result.outcome === 'abandoned' ||
    result.outcome === 'interrupted' ||
    result.outcome === 'in-progress'
  ) {
    return emptyDelta(current);
  }

  const s = s0;
  const prev = s.themeAttempts[result.themeId] ?? [];
  if (prev.some((a) => a.finishedAt === result.finishedAt && a.positionId === result.positionId)) {
    const existing = prev.find((a) => a.finishedAt === result.finishedAt && a.positionId === result.positionId)!;
    return {
      ...current,
      oldScore: current.score,
      newScore: current.score,
      attemptScore: existing.attemptScore,
      analysisStatus: existing.analysisStatus ?? 'pending',
      gradeConfidence: existing.gradeConfidence ?? null,
    };
  }

  const confidence = result.gradeConfidence ?? (typeof result.attemptScore === 'number' ? 'exact' : null);
  const status =
    result.analysisStatus ??
    (result.outcome === 'theoretical-loss'
      ? 'not-needed'
      : typeof result.attemptScore === 'number'
        ? confidence === 'estimated'
          ? 'estimated'
          : 'scored'
        : 'pending');
  const record: ThemeAttemptRecord = {
    positionId: result.positionId,
    themeId: result.themeId,
    outcome: result.outcome,
    userMoves: result.userMoves,
    scoreScale: result.scoreScale === 'legacy-10' ? 'legacy-10' : 'quality-5',
    attemptScore: result.attemptScore,
    finishedAt: result.finishedAt,
    durationMs: result.durationMs,
    startFen: result.startFen,
    playerColor: result.playerColor,
    moveSans: result.moveSans,
    variantGroup: result.variantGroup ?? result.positionId,
    objective: result.objective,
    analysisStatus: status,
    gradeConfidence: confidence,
    gradeCause: null,
    gradeProtocol: null,
    measuredDecisions: [],
    gradeCursor: 0,
  };

  s.themeAttempts[result.themeId] = [record, ...prev].slice(0, MAX_ATTEMPTS_PER_THEME);
  s.lastPositionByTheme[result.themeId] = result.positionId;
  rememberBest(s, record);

  await persist(s);
  const summary = summarizeAttempts(s.themeAttempts[result.themeId]!);
  return {
    ...summary,
    oldScore: current.score,
    newScore: summary.score,
    attemptScore: record.attemptScore,
    analysisStatus: status,
    gradeConfidence: confidence,
  };
}

export async function getAttempt(
  themeId: TheoreticalThemeId,
  positionId: string,
  finishedAt: string,
): Promise<ThemeAttemptRecord | null> {
  const s = await loadTheoreticalStore();
  return (
    (s.themeAttempts[themeId] ?? []).find(
      (attempt) => attempt.positionId === positionId && attempt.finishedAt === finishedAt,
    ) ?? null
  );
}

export async function updateAttemptGrade(
  themeId: TheoreticalThemeId,
  positionId: string,
  finishedAt: string,
  patch: Partial<
    Pick<
      ThemeAttemptRecord,
      | 'attemptScore'
      | 'analysisStatus'
      | 'gradeConfidence'
      | 'gradeCause'
      | 'gradeProtocol'
      | 'measuredDecisions'
      | 'gradeCursor'
      | 'gradeBudgetMs'
      | 'gradeStepIndex'
      | 'gradeDeadlineMs'
      | 'gradeConsumedMs'
    >
  >,
): Promise<ThemeAttemptRecord | null> {
  const s = await loadTheoreticalStore();
  const list = s.themeAttempts[themeId];
  if (!list) return null;
  const index = list.findIndex(
    (attempt) => attempt.positionId === positionId && attempt.finishedAt === finishedAt,
  );
  if (index < 0) return null;
  const next: ThemeAttemptRecord = { ...list[index]!, ...patch };
  list[index] = next;
  rememberBest(s, next);
  await persist(s);
  return next;
}

function preferAttempt(left: ThemeAttemptRecord, right: ThemeAttemptRecord): ThemeAttemptRecord {
  const scored = (record: ThemeAttemptRecord) => typeof record.attemptScore === 'number';
  if (scored(left) !== scored(right)) return scored(left) ? left : right;
  const cursor = (record: ThemeAttemptRecord) =>
    record.gradeCursor ?? record.measuredDecisions?.length ?? 0;
  if (cursor(left) !== cursor(right)) return cursor(left) > cursor(right) ? left : right;
  return left;
}

/** Union by position and finish time so a sync does not drop a win or a partial grade. */
export function mergeTheoreticalDocuments(local: unknown, remote: unknown): TheoreticalEndgameStoreV2 {
  const left = migrateTheoreticalStore(local);
  const right = migrateTheoreticalStore(remote);
  const themeIds = new Set([
    ...Object.keys(left.themeAttempts),
    ...Object.keys(right.themeAttempts),
  ]);
  const themeAttempts: Record<string, ThemeAttemptRecord[]> = {};
  for (const themeId of themeIds) {
    const byKey = new Map<string, ThemeAttemptRecord>();
    for (const record of [...(right.themeAttempts[themeId] ?? []), ...(left.themeAttempts[themeId] ?? [])]) {
      const key = `${record.positionId}|${record.finishedAt}`;
      const previous = byKey.get(key);
      byKey.set(key, previous ? preferAttempt(previous, record) : record);
    }
    const merged = [...byKey.values()]
      .sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1))
      .slice(0, MAX_ATTEMPTS_PER_THEME);
    if (merged.length > 0) themeAttempts[themeId] = merged;
  }
  const bestByPosition = { ...right.bestByPosition };
  for (const [positionId, value] of Object.entries(left.bestByPosition)) {
    const previous = bestByPosition[positionId];
    if (!previous || value.attemptScore > previous.attemptScore) bestByPosition[positionId] = value;
  }
  return {
    ...left,
    catalogView: left.catalogView,
    themeAttempts,
    lastPositionByTheme: { ...right.lastPositionByTheme, ...left.lastPositionByTheme },
    bestByPosition,
  };
}

export async function getAllThemeScores(): Promise<Record<string, ThemeScoreSummary>> {
  const s = await loadTheoreticalStore();
  const out: Record<string, ThemeScoreSummary> = {};
  for (const themeId of Object.keys(s.themeAttempts)) {
    out[themeId] = summarizeAttempts(s.themeAttempts[themeId] ?? []);
  }
  return out;
}

export async function getAllLegacyScores(): Promise<
  Record<string, { score: number; count: number }>
> {
  const s = await loadTheoreticalStore();
  const out: Record<string, { score: number; count: number }> = {};
  for (const themeId of Object.keys(s.themeAttempts)) {
    const legacy = averageLegacyScore(s.themeAttempts[themeId] ?? []);
    if (legacy.count > 0) out[themeId] = legacy;
  }
  return out;
}

export function clearTheoreticalStoreCache(): void {
  cache = null;
}

export { scoreAttempt };
