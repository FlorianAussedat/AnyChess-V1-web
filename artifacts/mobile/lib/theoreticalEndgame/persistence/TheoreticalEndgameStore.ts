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
import { getPositionById, listByTheme } from '../selection/selectors.ts';

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
  /**
   * Global score reset. Attempts with finishedAt <= this time stay out of
   * the stats and are not graded again. A cloud merge keeps the later time.
   */
  scoreResetAt?: string | null;
  /** How many global resets have been confirmed. Merged by maximum. */
  scoreResetGeneration?: number;
  /** Per-theme reset time. Combined with the global time: the later one wins. */
  themeScoreResetAt?: Record<string, string>;
  themeScoreResetGeneration?: Record<string, number>;
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
    scoreResetAt: null,
    scoreResetGeneration: 0,
    themeScoreResetAt: {},
    themeScoreResetGeneration: {},
  };
}

function laterIso(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

function asIso(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asGeneration(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function asIsoMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' && item) out[key] = item;
  }
  return out;
}

function asGenerationMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const generation = asGeneration(item);
    if (generation > 0) out[key] = generation;
  }
  return out;
}

export function gradeReliability(record: {
  attemptScore?: number | null;
  gradeConfidence?: GradeConfidence | null;
  analysisStatus?: AnalysisStatus | null;
}): number {
  if (typeof record.attemptScore !== 'number') return 0;
  if (record.gradeConfidence === 'estimated' || record.analysisStatus === 'estimated') return 1;
  return 2;
}

export function scoreCutoff(store: Pick<TheoreticalEndgameStoreV2, 'scoreResetAt' | 'themeScoreResetAt'>, themeId: string): string {
  const global = store.scoreResetAt ?? '';
  const theme = store.themeScoreResetAt?.[themeId] ?? '';
  return global > theme ? global : theme;
}

function attemptSurvives(record: ThemeAttemptRecord, cutoff: string): boolean {
  if (!cutoff) return true;
  return record.finishedAt > cutoff;
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

function themeOfPosition(
  positionId: string,
  attempts: Record<string, ThemeAttemptRecord[]>,
): string | null {
  const position = getPositionById(positionId);
  if (position) return position.themeId;
  for (const [themeId, list] of Object.entries(attempts)) {
    if (list.some((attempt) => attempt.positionId === positionId)) return themeId;
  }
  return null;
}

function rebuildBestsFrom(attempts: ThemeAttemptRecord[]): TheoreticalEndgameStoreV2['bestByPosition'] {
  const holder = emptyStore();
  for (const record of attempts) rememberBest(holder, record);
  return holder.bestByPosition;
}

/**
 * Drop attempts and records that a confirmed reset already voided.
 * Does nothing when no reset mark is stored, so loading this fix never
 * clears scores by itself.
 */
export function applyScoreResets(store: TheoreticalEndgameStoreV2): TheoreticalEndgameStoreV2 {
  const global = store.scoreResetAt ?? '';
  const themeMarks = store.themeScoreResetAt ?? {};
  if (!global && Object.keys(themeMarks).length === 0) return store;
  const themeAttempts: Record<string, ThemeAttemptRecord[]> = {};
  for (const [themeId, attempts] of Object.entries(store.themeAttempts)) {
    const cutoff = scoreCutoff(store, themeId);
    const kept = attempts.filter((attempt) => attemptSurvives(attempt, cutoff));
    if (kept.length > 0) themeAttempts[themeId] = kept;
  }
  let bestByPosition = store.bestByPosition;
  if (global) {
    bestByPosition = rebuildBestsFrom(Object.values(themeAttempts).flat());
  } else {
    const resetThemes = new Set(Object.keys(themeMarks));
    const next = { ...bestByPosition };
    for (const positionId of Object.keys(next)) {
      const themeId = themeOfPosition(positionId, store.themeAttempts);
      if (themeId && resetThemes.has(themeId)) delete next[positionId];
    }
    const rebuilt = rebuildBestsFrom(
      Object.entries(themeAttempts)
        .filter(([themeId]) => resetThemes.has(themeId))
        .flatMap(([, attempts]) => attempts),
    );
    bestByPosition = { ...next, ...rebuilt };
  }
  return { ...store, themeAttempts, bestByPosition };
}

/**
 * Migrate v1 → v2: keep catalogView, drop attempts/scores tied to legacy IDs.
 * Idempotent. A v2 document keeps its scores unless a reset mark is already there.
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
    return applyScoreResets({
      ...base,
      catalogView,
      themeAttempts: scrubLegacyAttempts(themeAttempts),
      lastPositionByTheme: scrubLastPositions(lastPositionByTheme),
      bestByPosition: scrubBest(bestByPosition),
      scoreResetAt: asIso(parsed.scoreResetAt),
      scoreResetGeneration: asGeneration(parsed.scoreResetGeneration),
      themeScoreResetAt: asIsoMap(parsed.themeScoreResetAt),
      themeScoreResetGeneration: asGenerationMap(parsed.themeScoreResetGeneration),
      migratedFromV1: parsed.migratedFromV1 === true,
    });
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
  const cutoff = scoreCutoff(s0, result.themeId);
  const current = summarizeAttempts(s0.themeAttempts[result.themeId] ?? []);
  if (
    result.outcome === 'abandoned' ||
    result.outcome === 'interrupted' ||
    result.outcome === 'in-progress'
  ) {
    return emptyDelta(current);
  }
  if (cutoff && result.finishedAt <= cutoff) return emptyDelta(current);

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
  const current = list[index]!;
  if (scoreCutoff(s, themeId) && current.finishedAt <= scoreCutoff(s, themeId)) return null;
  if (typeof patch.attemptScore === 'number') {
    const incoming = gradeReliability({
      attemptScore: patch.attemptScore,
      gradeConfidence: patch.gradeConfidence ?? current.gradeConfidence,
      analysisStatus: patch.analysisStatus ?? current.analysisStatus,
    });
    if (incoming < gradeReliability(current)) return current;
  }
  const next: ThemeAttemptRecord = { ...current, ...patch };
  list[index] = next;
  rememberBest(s, next);
  await persist(s);
  return next;
}

function preferAttempt(left: ThemeAttemptRecord, right: ThemeAttemptRecord): ThemeAttemptRecord {
  const leftRank = gradeReliability(left);
  const rightRank = gradeReliability(right);
  if (leftRank !== rightRank) return leftRank > rightRank ? left : right;
  const cursor = (record: ThemeAttemptRecord) =>
    record.gradeCursor ?? record.measuredDecisions?.length ?? 0;
  if (cursor(left) !== cursor(right)) return cursor(left) > cursor(right) ? left : right;
  return left;
}

function mergeResetMarks(
  left: TheoreticalEndgameStoreV2,
  right: TheoreticalEndgameStoreV2,
): Pick<
  TheoreticalEndgameStoreV2,
  'scoreResetAt' | 'scoreResetGeneration' | 'themeScoreResetAt' | 'themeScoreResetGeneration'
> {
  const themeIds = new Set([
    ...Object.keys(left.themeScoreResetAt ?? {}),
    ...Object.keys(right.themeScoreResetAt ?? {}),
  ]);
  const themeScoreResetAt: Record<string, string> = {};
  const themeScoreResetGeneration: Record<string, number> = {};
  for (const themeId of themeIds) {
    const at = laterIso(left.themeScoreResetAt?.[themeId], right.themeScoreResetAt?.[themeId]);
    if (at) themeScoreResetAt[themeId] = at;
    const generation = Math.max(
      left.themeScoreResetGeneration?.[themeId] ?? 0,
      right.themeScoreResetGeneration?.[themeId] ?? 0,
    );
    if (generation > 0) themeScoreResetGeneration[themeId] = generation;
  }
  return {
    scoreResetAt: laterIso(left.scoreResetAt, right.scoreResetAt),
    scoreResetGeneration: Math.max(left.scoreResetGeneration ?? 0, right.scoreResetGeneration ?? 0),
    themeScoreResetAt,
    themeScoreResetGeneration,
  };
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
  const marks = mergeResetMarks(left, right);
  return applyScoreResets({
    ...left,
    ...marks,
    catalogView: left.catalogView,
    themeAttempts,
    lastPositionByTheme: { ...right.lastPositionByTheme, ...left.lastPositionByTheme },
    bestByPosition,
  });
}

function positionsOfTheme(themeId: string, attempts: ThemeAttemptRecord[]): Set<string> {
  const ids = new Set<string>();
  for (const attempt of attempts) ids.add(attempt.positionId);
  for (const position of listByTheme(themeId as TheoreticalThemeId)) ids.add(position.id);
  return ids;
}

export async function resetTheoreticalTheme(
  themeId: TheoreticalThemeId,
  at = new Date().toISOString(),
): Promise<void> {
  const store = await loadTheoreticalStore();
  const removed = store.themeAttempts[themeId] ?? [];
  const generation = (store.themeScoreResetGeneration?.[themeId] ?? 0) + 1;
  const mark = laterIso(store.themeScoreResetAt?.[themeId], at) ?? at;
  store.themeScoreResetAt = { ...(store.themeScoreResetAt ?? {}), [themeId]: mark };
  store.themeScoreResetGeneration = { ...(store.themeScoreResetGeneration ?? {}), [themeId]: generation };
  const cutoff = scoreCutoff(store, themeId);
  const kept = removed.filter((attempt) => attemptSurvives(attempt, cutoff));
  if (kept.length > 0) store.themeAttempts[themeId] = kept;
  else delete store.themeAttempts[themeId];
  for (const positionId of positionsOfTheme(themeId, removed)) {
    delete store.bestByPosition[positionId];
  }
  for (const record of kept) rememberBest(store, record);
  await persist(store);
}

export async function resetAllTheoreticalScores(at = new Date().toISOString()): Promise<void> {
  const store = await loadTheoreticalStore();
  store.scoreResetAt = laterIso(store.scoreResetAt, at) ?? at;
  store.scoreResetGeneration = (store.scoreResetGeneration ?? 0) + 1;
  const next: Record<string, ThemeAttemptRecord[]> = {};
  for (const [themeId, attempts] of Object.entries(store.themeAttempts)) {
    const kept = attempts.filter((attempt) => attemptSurvives(attempt, scoreCutoff(store, themeId)));
    if (kept.length > 0) next[themeId] = kept;
  }
  store.themeAttempts = next;
  store.bestByPosition = rebuildBestsFrom(Object.values(next).flat());
  await persist(store);
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
