/**
 * Complementary grade after the game.
 *
 * In-play searches are short and can mix a catalog distance with an engine
 * distance. This pass uses one protocol for every user decision: the exact
 * table when it covers the whole line, otherwise a progressive engine budget.
 * A hole is filled at the next step instead of aborting the job. Finished
 * decisions stay stored so a retry continues. Centipawns never become a
 * mate distance. Draw successes are graded by the demonstrated mechanism.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalysis, DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import { assessDefense } from '../domain/defenseFinish.ts';
import { assessPawnWin } from '../domain/pawnWinProgress.ts';
import { assessMateDrive } from '../domain/mateDrive.ts';
import { gradeFamilyFor } from '../domain/gradeFamily.ts';
import { exactUserDtm } from '../domain/exactElementary.ts';
import { gradeQuality } from '../domain/comprehensionScore.ts';
import { dtmAfterUserMove, dtmOnUserTurn } from '../domain/mateDistance.ts';
import { wdlToPlayerResult } from '../domain/theoreticalResult.ts';
import type {
  AnalysisStatus,
  GradeCause,
  GradeConfidence,
  MeasuredDecision,
  PlayerColor,
} from '../domain/types.ts';
import {
  getAttempt,
  loadTheoreticalStore,
  updateAttemptGrade,
  type ThemeAttemptRecord,
} from '../persistence/TheoreticalEndgameStore.ts';
import { replayUserDecisions, type UserDecisionPoint } from './decisionPath.ts';
import { gradeTokenCurrent, takeGradeToken } from './gradeGate.ts';

/** Homogeneous first step, higher than the in-game think time (1000 ms). */
export const POST_GAME_MOVETIME_MS = 1500;
/** Progressive fill of holes. A later step only re-searches missing mates. */
export const POST_GAME_BUDGET_STEPS_MS = [400, 900, 1600] as const;
/** Last step for long wins (two bishops, DTM ~30) where 1600 ms still misses the opening. */
export const POST_GAME_LONG_BUDGET_STEPS_MS = [400, 900, 1600, 3000] as const;
/** Fallback when the caller does not pass a deadline. Long lines use adaptiveDeadlineMs. */
export const POST_GAME_DEADLINE_MS = 12_000;
/** Wall-clock cap for one attempt, kept across resumes. Individual searches stay shorter. */
export const POST_GAME_ATTEMPT_BUDGET_MS = 25_000;

export type PostGameRequest = {
  themeId: ThemeAttemptRecord['themeId'];
  positionId: string;
  finishedAt: string;
  analyzer: DefenseAnalyzer;
  movetimeMs?: number;
  deadlineMs?: number;
  budgetStepsMs?: number[];
  /** Default true. Tests of a single abort step turn this off. */
  mateDriveFallback?: boolean;
  now?: () => number;
  onProgress?: (record: ThemeAttemptRecord) => void | Promise<void>;
};

export function adaptiveDeadlineMs(decisionCount: number): number {
  // Two analyses per decision, then hole retries at later steps.
  return Math.min(
    POST_GAME_ATTEMPT_BUDGET_MS,
    Math.max(POST_GAME_DEADLINE_MS, decisionCount * 3500 + 8000),
  );
}

function attackerOf(color: PlayerColor): 'w' | 'b' {
  return color === 'white' ? 'w' : 'b';
}

function isCheckmate(fen: string): boolean {
  try {
    return new Chess(fen).isCheckmate();
  } catch {
    return false;
  }
}

function resultFromAnalysis(
  analysis: DefenseAnalysis | null,
  fen: string,
  playerColor: PlayerColor,
): 'WIN' | 'DRAW' | 'LOSS' | null {
  if (isCheckmate(fen)) return 'WIN';
  if (!analysis) return null;
  const stm = fen.split(' ')[1] === 'b' ? 'b' : 'w';
  return wdlToPlayerResult(analysis.wdl, stm, playerColor);
}

function decisionComplete(decision: MeasuredDecision | undefined): boolean {
  return decision != null && decision.dtmBefore != null && decision.dtmAfter != null;
}

/** Exact distances for the whole line, or null when any position is outside the table. */
export function exactTrace(
  points: UserDecisionPoint[],
  attacker: 'w' | 'b',
): MeasuredDecision[] | null {
  if (points.length === 0) return null;
  const measured: MeasuredDecision[] = [];
  for (const point of points) {
    const before = exactUserDtm(point.fenBefore, attacker);
    const mate = isCheckmate(point.fenAfter);
    const after = mate ? 0 : exactUserDtm(point.fenAfter, attacker);
    if (before == null || after == null) return null;
    measured.push({
      fenBefore: point.fenBefore,
      san: point.san,
      fenAfter: point.fenAfter,
      dtmBefore: before,
      dtmAfter: after,
      beforeSource: 'exact',
      afterSource: mate ? 'observed' : 'exact',
      resultAfterReply: mate ? 'WIN' : null,
    });
  }
  return measured;
}

async function save(
  request: PostGameRequest,
  patch: Partial<ThemeAttemptRecord>,
): Promise<ThemeAttemptRecord | null> {
  const latest = await getAttempt(request.themeId, request.positionId, request.finishedAt);
  if (!latest) return null;
  const latestCursor = latest.gradeCursor ?? 0;
  const patchCursor = patch.gradeCursor ?? latestCursor;
  // A newer job may already have published a score or moved the cursor.
  if (typeof latest.attemptScore === 'number' && patch.attemptScore == null) return latest;
  if (patch.attemptScore == null && patchCursor < latestCursor) return latest;
  const updated = await updateAttemptGrade(
    request.themeId,
    request.positionId,
    request.finishedAt,
    patch,
  );
  if (updated && request.onProgress) await request.onProgress(updated);
  return updated;
}

function publishFrom(
  measured: MeasuredDecision[],
  userMoves: number,
  confidence: GradeConfidence,
  status: AnalysisStatus,
): { attemptScore: number; analysisStatus: AnalysisStatus; gradeConfidence: GradeConfidence } | null {
  if (measured.some((decision) => decision.dtmBefore == null || decision.dtmAfter == null)) {
    return null;
  }
  const quality = gradeQuality({
    outcome: 'success',
    objective: 'WIN',
    userMoves,
    decisions: measured.map((decision) => ({
      dtmBefore: decision.dtmBefore,
      dtmAfter: decision.dtmAfter,
      resultAfterReply: decision.resultAfterReply,
    })),
  });
  if (typeof quality.score !== 'number') return null;
  return { attemptScore: quality.score, analysisStatus: status, gradeConfidence: confidence };
}

async function settleDraw(
  current: ThemeAttemptRecord,
  request: PostGameRequest,
): Promise<ThemeAttemptRecord | null> {
  if (!current.startFen || !current.playerColor || !current.moveSans) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-trajectory',
      attemptScore: null,
      gradeConfidence: null,
    });
  }
  const defense = assessDefense({
    themeId: current.themeId,
    initialFen: current.startFen,
    sans: current.moveSans,
    playerColor: current.playerColor,
    objective: 'DRAW',
  });
  if (!defense.demonstrated) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'draw-without-mechanism',
      attemptScore: null,
      gradeConfidence: null,
      gradeProtocol: null,
    });
  }
  const quality = gradeQuality({
    outcome: 'success',
    objective: 'DRAW',
    userMoves: current.userMoves,
    mechanism: { demonstrated: true, slackMoves: defense.slackMoves },
  });
  return save(request, {
    attemptScore: quality.score,
    analysisStatus: 'scored',
    gradeConfidence: 'exact',
    gradeCause: null,
    gradeProtocol: 'exact',
  });
}

async function settlePawnWin(
  current: ThemeAttemptRecord,
  request: PostGameRequest,
): Promise<ThemeAttemptRecord | null> {
  if (!current.startFen || !current.playerColor || !current.moveSans) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-trajectory',
      attemptScore: null,
      gradeConfidence: null,
    });
  }
  const progress = assessPawnWin({
    themeId: current.themeId,
    initialFen: current.startFen,
    sans: current.moveSans,
    playerColor: current.playerColor,
    objective: 'WIN',
  });
  if (!progress.demonstrated) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'progress-without-marker',
      attemptScore: null,
      gradeConfidence: null,
      gradeProtocol: null,
    });
  }
  const quality = gradeQuality({
    outcome: 'success',
    objective: 'WIN',
    userMoves: current.userMoves,
    progress: { demonstrated: true, slackMoves: progress.slackMoves },
  });
  return save(request, {
    attemptScore: quality.score,
    analysisStatus: 'scored',
    gradeConfidence: 'exact',
    gradeCause: null,
    gradeProtocol: 'exact',
  });
}

async function settleMateDrive(
  current: ThemeAttemptRecord,
  request: PostGameRequest,
): Promise<ThemeAttemptRecord | null> {
  if (!current.startFen || !current.playerColor || !current.moveSans) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-trajectory',
      attemptScore: null,
      gradeConfidence: null,
    });
  }
  const drive = assessMateDrive({
    initialFen: current.startFen,
    sans: current.moveSans,
    playerColor: current.playerColor,
  });
  if (!drive.demonstrated) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'progress-without-marker',
      attemptScore: null,
      gradeConfidence: null,
    });
  }
  const quality = gradeQuality({
    outcome: 'success',
    objective: 'WIN',
    userMoves: current.userMoves,
    progress: { demonstrated: true, slackMoves: drive.slackMoves },
  });
  return save(request, {
    attemptScore: quality.score,
    analysisStatus: 'estimated',
    gradeConfidence: 'estimated',
    gradeCause: null,
    gradeProtocol: 'engine',
  });
}

/** Continue stored successes whose analysis was interrupted. Failures stay for an explicit retry. */
export async function resumePendingGrades(
  analyzer: DefenseAnalyzer,
  options: { movetimeMs?: number; deadlineMs?: number } = {},
): Promise<void> {
  const store = await loadTheoreticalStore();
  for (const attempts of Object.values(store.themeAttempts)) {
    for (const attempt of attempts) {
      if (attempt.analysisStatus !== 'pending' || attempt.outcome !== 'success') continue;
      if (!attempt.startFen) continue;
      await runPostGameGrade({
        themeId: attempt.themeId,
        positionId: attempt.positionId,
        finishedAt: attempt.finishedAt,
        analyzer,
        movetimeMs: options.movetimeMs,
        deadlineMs: options.deadlineMs,
      });
    }
  }
}

function budgetStepsFor(request: PostGameRequest, decisionCount: number): number[] {
  if (request.budgetStepsMs && request.budgetStepsMs.length > 0) {
    return request.budgetStepsMs.filter((ms) => ms > 0);
  }
  if (request.movetimeMs != null) return [request.movetimeMs];
  if (decisionCount >= 10) return [...POST_GAME_LONG_BUDGET_STEPS_MS];
  return [...POST_GAME_BUDGET_STEPS_MS];
}

async function fallbackMateDrive(
  current: ThemeAttemptRecord,
  request: PostGameRequest,
): Promise<ThemeAttemptRecord | null> {
  if (request.mateDriveFallback === false) return null;
  if (!current.startFen || !current.playerColor || !current.moveSans) return null;
  const drive = assessMateDrive({
    initialFen: current.startFen,
    sans: current.moveSans,
    playerColor: current.playerColor,
  });
  if (!drive.demonstrated) return null;
  return settleMateDrive(current, request);
}

export async function runPostGameGrade(request: PostGameRequest): Promise<ThemeAttemptRecord | null> {
  const current = await getAttempt(request.themeId, request.positionId, request.finishedAt);
  if (!current) return null;
  if (current.outcome === 'theoretical-loss') return current;
  if (current.analysisStatus === 'scored' || current.analysisStatus === 'estimated') return current;
  if (current.outcome !== 'success') return current;
  // Draw and pawn-win grades do not use the engine: play may keep it.
  if (current.objective === 'DRAW') return settleDraw(current, request);
  const family = gradeFamilyFor(current.themeId, current.objective ?? 'WIN');
  if (family === 'pawn-win') return settlePawnWin(current, request);

  const now = request.now ?? Date.now;
  const started = now();
  const alreadyConsumed = current.gradeConsumedMs ?? 0;
  const attemptBudget = deadlineFor(request, current);

  if (!current.startFen || !current.playerColor || !current.moveSans) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-trajectory',
      attemptScore: null,
      gradeConfidence: null,
    });
  }

  const points = replayUserDecisions(current.startFen, current.playerColor, current.moveSans);
  const steps = budgetStepsFor(request, points.length);
  const expired = () => alreadyConsumed + (now() - started) >= attemptBudget;
  if (points.length === 0) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-user-moves',
      attemptScore: null,
      gradeConfidence: null,
    });
  }

  if (current.gradeProtocol !== 'engine') {
    const exact = exactTrace(points, attackerOf(current.playerColor));
    if (exact && !expired()) {
      const published = publishFrom(exact, current.userMoves, 'exact', 'scored');
      if (published) {
        return save(request, {
          ...published,
          measuredDecisions: exact,
          gradeCursor: exact.length,
          gradeProtocol: 'exact',
          gradeCause: null,
        });
      }
    }
  }

  const token = takeGradeToken();
  if (token == null) {
    if (current.analysisStatus === 'running') {
      return save(request, {
        analysisStatus: 'pending',
        gradeCause: 'interrupted-by-play',
        gradeDeadlineMs: attemptBudget,
        gradeConsumedMs: alreadyConsumed + (now() - started),
      });
    }
    const driven = await fallbackMateDrive(current, request);
    if (driven?.attemptScore != null) return driven;
    return current;
  }
  if (expired()) {
    const driven = await fallbackMateDrive(current, request);
    if (driven?.attemptScore != null) return driven;
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'deadline',
      gradeDeadlineMs: attemptBudget,
      gradeConsumedMs: alreadyConsumed + (now() - started),
      attemptScore: null,
      gradeConfidence: null,
    });
  }

  let measured: MeasuredDecision[] =
    current.gradeProtocol === 'engine' ? [...(current.measuredDecisions ?? [])] : [];
  let cursor = current.gradeProtocol === 'engine' ? current.gradeCursor ?? measured.length : 0;
  if (cursor > measured.length) cursor = measured.length;
  measured = measured.slice(0, cursor);
  let stepIndex = current.gradeProtocol === 'engine' ? current.gradeStepIndex ?? 0 : 0;
  if (stepIndex < 0 || stepIndex >= steps.length) stepIndex = 0;

  const interrupt = async (
    index: number,
    cause: GradeCause,
    status: AnalysisStatus,
  ): Promise<ThemeAttemptRecord | null> =>
    save(request, {
      analysisStatus: status,
      gradeCause: cause,
      measuredDecisions: measured,
      gradeCursor: index,
      gradeProtocol: 'engine',
      gradeBudgetMs: steps[stepIndex] ?? steps[0],
      gradeStepIndex: stepIndex,
      gradeDeadlineMs: attemptBudget,
      gradeConsumedMs: alreadyConsumed + (now() - started),
      attemptScore: null,
      gradeConfidence: null,
    });

  await save(request, {
    analysisStatus: 'running',
    gradeProtocol: 'engine',
    measuredDecisions: measured,
    gradeCursor: cursor,
    gradeBudgetMs: steps[stepIndex] ?? steps[0],
    gradeStepIndex: stepIndex,
    gradeDeadlineMs: attemptBudget,
    gradeConsumedMs: alreadyConsumed,
    attemptScore: null,
    gradeConfidence: null,
    gradeCause: null,
  });

  const measurePoint = async (
    point: UserDecisionPoint,
    existing: MeasuredDecision | undefined,
    movetime: number,
    index: number,
  ): Promise<'ok' | 'interrupt'> => {
    if (decisionComplete(existing)) return 'ok';
    if (!gradeTokenCurrent(token)) return 'interrupt';
    if (expired()) return 'interrupt';
    try {
      const beforeAnalysis = await request.analyzer.analyze(point.fenBefore, movetime);
      if (!gradeTokenCurrent(token)) return 'interrupt';
      const dtmBefore = dtmOnUserTurn(beforeAnalysis.mateIn);
      let dtmAfter: number | null = null;
      let afterSource: MeasuredDecision['afterSource'] = null;
      let afterAnalysis: DefenseAnalysis | null = null;
      if (isCheckmate(point.fenAfter)) {
        dtmAfter = 0;
        afterSource = 'observed';
      } else {
        if (expired()) return 'interrupt';
        afterAnalysis = await request.analyzer.analyze(point.fenAfter, movetime);
        if (!gradeTokenCurrent(token)) return 'interrupt';
        dtmAfter = dtmAfterUserMove(afterAnalysis.mateIn);
        afterSource = dtmAfter == null ? null : 'engine';
      }
      const next: MeasuredDecision = {
        fenBefore: point.fenBefore,
        san: point.san,
        fenAfter: point.fenAfter,
        dtmBefore,
        dtmAfter,
        beforeSource: dtmBefore == null ? null : 'engine',
        afterSource,
        resultAfterReply: resultFromAnalysis(
          afterAnalysis,
          point.fenAfter,
          current.playerColor!,
        ),
      };
      if (existing) measured[index] = next;
      else measured = [...measured, next];
      return 'ok';
    } catch {
      return 'interrupt';
    }
  };

  for (let index = cursor; index < points.length; index += 1) {
    if (!gradeTokenCurrent(token)) return interrupt(index, 'interrupted-by-play', 'pending');
    if (expired()) {
      const driven = await fallbackMateDrive(current, request);
      if (driven?.attemptScore != null) return driven;
      return interrupt(index, 'deadline', 'failed');
    }
    const point = points[index]!;
    const status = await measurePoint(point, measured[index], steps[stepIndex]!, index);
    if (status === 'interrupt') {
      const live = gradeTokenCurrent(token);
      if (live && expired()) {
        const driven = await fallbackMateDrive(current, request);
        if (driven?.attemptScore != null) return driven;
      }
      return interrupt(index, live ? (expired() ? 'deadline' : 'engine-error') : 'interrupted-by-play', live ? 'failed' : 'pending');
    }
    await save(request, {
      analysisStatus: 'running',
      gradeProtocol: 'engine',
      measuredDecisions: measured,
      gradeCursor: index + 1,
      gradeBudgetMs: steps[stepIndex],
      gradeStepIndex: stepIndex,
      attemptScore: null,
      gradeConfidence: null,
      gradeCause: null,
    });
  }

  while (measured.some((decision) => !decisionComplete(decision))) {
    if (!gradeTokenCurrent(token)) return interrupt(points.length, 'interrupted-by-play', 'pending');
    if (expired()) {
      const driven = await fallbackMateDrive(current, request);
      if (driven?.attemptScore != null) return driven;
      return interrupt(points.length, 'deadline', 'failed');
    }
    if (stepIndex + 1 >= steps.length) {
      const driven = await fallbackMateDrive(current, request);
      if (driven?.attemptScore != null) return driven;
      return interrupt(points.length, 'engine-no-mate', 'failed');
    }
    stepIndex += 1;
    const movetime = steps[stepIndex]!;
    await save(request, {
      analysisStatus: 'running',
      gradeProtocol: 'engine',
      measuredDecisions: measured,
      gradeCursor: points.length,
      gradeBudgetMs: movetime,
      gradeStepIndex: stepIndex,
      attemptScore: null,
      gradeConfidence: null,
      gradeCause: null,
    });
    for (let index = points.length - 1; index >= 0; index -= 1) {
      if (decisionComplete(measured[index])) continue;
      if (!gradeTokenCurrent(token)) return interrupt(points.length, 'interrupted-by-play', 'pending');
      if (expired()) {
        const driven = await fallbackMateDrive(current, request);
        if (driven?.attemptScore != null) return driven;
        return interrupt(points.length, 'deadline', 'failed');
      }
      const status = await measurePoint(points[index]!, measured[index], movetime, index);
      if (status === 'interrupt') {
        const live = gradeTokenCurrent(token);
        return interrupt(
          points.length,
          live ? (expired() ? 'deadline' : 'engine-error') : 'interrupted-by-play',
          live ? 'failed' : 'pending',
        );
      }
      await save(request, {
        analysisStatus: 'running',
        gradeProtocol: 'engine',
        measuredDecisions: measured,
        gradeCursor: points.length,
        gradeBudgetMs: movetime,
        gradeStepIndex: stepIndex,
        attemptScore: null,
        gradeConfidence: null,
        gradeCause: null,
      });
    }
  }

  if (!gradeTokenCurrent(token)) return interrupt(points.length, 'interrupted-by-play', 'pending');
  const published = publishFrom(measured, current.userMoves, 'estimated', 'estimated');
  if (!published) {
    const driven = await fallbackMateDrive(current, request);
    if (driven?.attemptScore != null) return driven;
    return interrupt(measured.length, 'engine-no-mate', 'failed');
  }
  return save(request, {
    ...published,
    measuredDecisions: measured,
    gradeCursor: measured.length,
    gradeProtocol: 'engine',
    gradeBudgetMs: steps[stepIndex] ?? steps[0],
    gradeStepIndex: stepIndex,
    gradeCause: null,
  });
}

function deadlineFor(request: PostGameRequest, current: ThemeAttemptRecord): number {
  const stored = current.gradeDeadlineMs;
  if (typeof stored === 'number' && stored > 0) {
    return Math.min(stored, POST_GAME_ATTEMPT_BUDGET_MS);
  }
  if (request.deadlineMs != null) return Math.min(request.deadlineMs, POST_GAME_ATTEMPT_BUDGET_MS);
  const count = Math.max(1, Math.ceil((current.moveSans?.length ?? current.userMoves ?? 1) / 2));
  return adaptiveDeadlineMs(count);
}
