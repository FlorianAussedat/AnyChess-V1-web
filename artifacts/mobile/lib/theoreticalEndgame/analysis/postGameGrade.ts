/**
 * Complementary grade after the game.
 *
 * In-play searches are short and can mix a catalog distance with an engine
 * distance. This pass uses one protocol for every user decision: the exact
 * table when it covers the whole line, otherwise one engine movetime.
 * A deadline ends the job. Finished decisions stay stored so a retry continues.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import { assessDefense } from '../domain/defenseFinish.ts';
import { exactUserDtm } from '../domain/exactElementary.ts';
import { gradeQuality } from '../domain/comprehensionScore.ts';
import { dtmAfterUserMove, dtmOnUserTurn } from '../domain/mateDistance.ts';
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

/** Higher than the in-game think time (1000 ms), and the same value for every position. */
export const POST_GAME_MOVETIME_MS = 1500;
/** The whole job stops. A single position cannot wait forever. */
export const POST_GAME_DEADLINE_MS = 12_000;

export type PostGameRequest = {
  themeId: ThemeAttemptRecord['themeId'];
  positionId: string;
  finishedAt: string;
  analyzer: DefenseAnalyzer;
  movetimeMs?: number;
  deadlineMs?: number;
  now?: () => number;
  onProgress?: (record: ThemeAttemptRecord) => void | Promise<void>;
};

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
  });
}

/** Continue stored wins whose analysis was interrupted. Failures stay for an explicit retry. */
export async function resumePendingGrades(
  analyzer: DefenseAnalyzer,
  options: { movetimeMs?: number; deadlineMs?: number } = {},
): Promise<void> {
  const store = await loadTheoreticalStore();
  for (const attempts of Object.values(store.themeAttempts)) {
    for (const attempt of attempts) {
      if (attempt.analysisStatus !== 'pending' || attempt.outcome !== 'success') continue;
      if (attempt.objective === 'DRAW' || !attempt.startFen) continue;
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

export async function runPostGameGrade(request: PostGameRequest): Promise<ThemeAttemptRecord | null> {
  const token = takeGradeToken();
  const current = await getAttempt(request.themeId, request.positionId, request.finishedAt);
  if (!current) return null;
  if (token == null) {
    if (current.analysisStatus === 'running') {
      return save(request, { analysisStatus: 'pending', gradeCause: 'interrupted-by-play' });
    }
    return current;
  }
  if (current.outcome === 'theoretical-loss') return current;
  if (current.analysisStatus === 'scored' || current.analysisStatus === 'estimated') return current;
  if (current.outcome !== 'success') return current;
  if (current.objective === 'DRAW') return settleDraw(current, request);

  const now = request.now ?? Date.now;
  const started = now();
  const deadline = request.deadlineMs ?? POST_GAME_DEADLINE_MS;
  const movetime = request.movetimeMs ?? POST_GAME_MOVETIME_MS;
  const expired = () => now() - started >= deadline;

  if (!current.startFen || !current.playerColor || !current.moveSans) {
    return save(request, {
      analysisStatus: 'failed',
      gradeCause: 'no-trajectory',
      attemptScore: null,
      gradeConfidence: null,
    });
  }

  const points = replayUserDecisions(current.startFen, current.playerColor, current.moveSans);
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
    if (exact && !expired() && gradeTokenCurrent(token)) {
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

  let measured: MeasuredDecision[] =
    current.gradeProtocol === 'engine' ? [...(current.measuredDecisions ?? [])] : [];
  let cursor = current.gradeProtocol === 'engine' ? current.gradeCursor ?? measured.length : 0;
  if (cursor > measured.length) cursor = measured.length;
  measured = measured.slice(0, cursor);

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
      attemptScore: null,
      gradeConfidence: null,
    });

  await save(request, {
    analysisStatus: 'running',
    gradeProtocol: 'engine',
    measuredDecisions: measured,
    gradeCursor: cursor,
    attemptScore: null,
    gradeConfidence: null,
    gradeCause: null,
  });

  for (let index = cursor; index < points.length; index += 1) {
    if (!gradeTokenCurrent(token)) return interrupt(index, 'interrupted-by-play', 'pending');
    if (expired()) return interrupt(index, 'deadline', 'failed');
    const point = points[index]!;
    try {
      const beforeAnalysis = await request.analyzer.analyze(point.fenBefore, movetime);
      if (!gradeTokenCurrent(token)) return interrupt(index, 'interrupted-by-play', 'pending');
      const dtmBefore = dtmOnUserTurn(beforeAnalysis.mateIn);
      let dtmAfter: number | null = null;
      let afterSource: MeasuredDecision['afterSource'] = null;
      if (isCheckmate(point.fenAfter)) {
        dtmAfter = 0;
        afterSource = 'observed';
      } else {
        if (expired()) return interrupt(index, 'deadline', 'failed');
        const afterAnalysis = await request.analyzer.analyze(point.fenAfter, movetime);
        if (!gradeTokenCurrent(token)) return interrupt(index, 'interrupted-by-play', 'pending');
        dtmAfter = dtmAfterUserMove(afterAnalysis.mateIn);
        afterSource = dtmAfter == null ? null : 'engine';
      }
      if (dtmBefore == null || dtmAfter == null) {
        return interrupt(index, 'engine-no-mate', 'failed');
      }
      measured = [
        ...measured,
        {
          fenBefore: point.fenBefore,
          san: point.san,
          fenAfter: point.fenAfter,
          dtmBefore,
          dtmAfter,
          beforeSource: 'engine',
          afterSource,
        },
      ];
      await save(request, {
        analysisStatus: 'running',
        gradeProtocol: 'engine',
        measuredDecisions: measured,
        gradeCursor: index + 1,
        attemptScore: null,
        gradeConfidence: null,
        gradeCause: null,
      });
    } catch {
      const live = gradeTokenCurrent(token);
      return interrupt(index, live ? 'engine-error' : 'interrupted-by-play', live ? 'failed' : 'pending');
    }
  }

  if (!gradeTokenCurrent(token)) return interrupt(points.length, 'interrupted-by-play', 'pending');
  const published = publishFrom(measured, current.userMoves, 'estimated', 'estimated');
  if (!published) {
    return interrupt(measured.length, 'engine-no-mate', 'failed');
  }
  return save(request, {
    ...published,
    measuredDecisions: measured,
    gradeCursor: measured.length,
    gradeProtocol: 'engine',
    gradeCause: null,
  });
}
