/**
 * A measured path is not automatically a published score.
 * Exact distances and engine estimates are not combined into one grade.
 */
import type { GradeDecision } from './comprehensionScore.ts';
import type {
  AnalysisStatus,
  AttemptOutcome,
  DistanceSource,
  GradeConfidence,
  QualityGrade,
} from './types.ts';

export type GradePublication = {
  attemptScore: number | null;
  analysisStatus: AnalysisStatus;
  gradeConfidence: GradeConfidence;
};

function sourceIsExact(source: DistanceSource | null | undefined): boolean {
  return source === 'exact' || source === 'observed';
}

/** Every distance is present and comes from an exact source or a seen checkmate. */
export function traceIsUniformlyExact(decisions: GradeDecision[] | undefined): boolean {
  if (!decisions || decisions.length === 0) return false;
  return decisions.every(
    (decision) =>
      decision.dtmBefore != null &&
      decision.dtmAfter != null &&
      sourceIsExact(decision.beforeSource) &&
      sourceIsExact(decision.afterSource),
  );
}

export function publicationFor(input: {
  outcome: AttemptOutcome;
  objective: 'WIN' | 'DRAW';
  quality: QualityGrade;
  decisions?: GradeDecision[];
  mechanismDemonstrated?: boolean;
  progressDemonstrated?: boolean;
  /** Board-observed pawn/promotion progress is exact. A mate-drive fallback is estimated. */
  progressExact?: boolean;
}): GradePublication {
  if (
    input.outcome === 'abandoned' ||
    input.outcome === 'interrupted' ||
    input.outcome === 'in-progress'
  ) {
    return { attemptScore: null, analysisStatus: 'not-needed', gradeConfidence: null };
  }
  if (input.outcome === 'theoretical-loss') {
    return { attemptScore: 0, analysisStatus: 'not-needed', gradeConfidence: 'exact' };
  }
  if (input.objective === 'DRAW') {
    if (input.mechanismDemonstrated && typeof input.quality.score === 'number') {
      return {
        attemptScore: input.quality.score,
        analysisStatus: 'scored',
        gradeConfidence: 'exact',
      };
    }
    return { attemptScore: null, analysisStatus: 'failed', gradeConfidence: null };
  }
  if (
    input.progressDemonstrated &&
    input.quality.reason === 'progress' &&
    typeof input.quality.score === 'number'
  ) {
    const exact = input.progressExact === true;
    return {
      attemptScore: input.quality.score,
      analysisStatus: exact ? 'scored' : 'estimated',
      gradeConfidence: exact ? 'exact' : 'estimated',
    };
  }
  if (traceIsUniformlyExact(input.decisions) && typeof input.quality.score === 'number') {
    return {
      attemptScore: input.quality.score,
      analysisStatus: 'scored',
      gradeConfidence: 'exact',
    };
  }
  return { attemptScore: null, analysisStatus: 'pending', gradeConfidence: null };
}
