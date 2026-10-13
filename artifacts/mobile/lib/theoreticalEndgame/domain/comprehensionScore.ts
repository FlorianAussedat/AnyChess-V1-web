/**
 * Theoretical endgame grade — scale quality-5 (theoretical-quality-v1).
 *
 * Unit: a "coup" is one move by the user, from their side. It is not a ply
 * and not a full move (White+Black). Time and any target-move count are
 * not inputs. The initial mate distance is not a target for the whole game.
 *
 * Failure is 0. Abandon and technical interruption have no grade.
 * A success is 1, 1.5, …, 5. Half-points are the only fractions.
 * 0 is never used for a success.
 *
 * Winning line. Each user decision is the position they actually faced and
 * the position immediately after their move, before the opponent replies.
 * wasted plies = max(0, dtmAfter - (dtmBefore - 1)).
 * extra = ceil(sum of wasted plies / 2), plus 4 per temporary loss of the
 * result that was later recovered on a complete trace.
 * A reply that shortens the mate changes only the next dtmBefore. It does
 * not cancel tempi already lost. Keeping the same distance is already waste.
 *
 * Draw. Slack counts user moves that leave a demonstrated idea (barrier,
 * lateral rook, saving corner, checking distance, capture, square).
 * A recognised alternative is graded the same way. A success whose method
 * was not measured has no grade: "Qualité non évaluée", never an automatic 2.
 *
 * If any winning decision has no reliable distance, or a draw has no
 * measured mechanism, the score is null. Missing data is never filled with 5.
 *
 * Bands (extra = measured detours):
 *   0 → 5   mastered
 *   1 → 4.5 small
 *   2 → 4
 *   3–4 → 3.5
 *   5–6 → 3
 *   7–8 → 2.5
 *   9–12 → 2
 *   13–16 → 1.5
 *   ≥ 17 → 1
 * A one-move wobble is a half-point because the scale allows halves and a
 * single tempo is smaller than "several detours" (3+).
 */
import type {
  AttemptOutcome,
  GradeConfidence,
  QualityGrade,
  ScoreScaleId,
  DistanceSource,
} from './types.ts';
import { wastedPlies } from './mateDistance.ts';

export const QUALITY_SCORE_VERSION = 'theoretical-quality-v1' as const;

export type GradeOutcome = AttemptOutcome;

export type GradeDecision = {
  resultAfterReply?: 'WIN' | 'DRAW' | 'LOSS' | null;
  /** Mate distance in plies, user to move, before this move. */
  dtmBefore?: number | null;
  /**
   * Mate distance in plies immediately after this move, before the reply.
   * 0 means the user has just checkmated.
   */
  dtmAfter?: number | null;
  beforeSource?: DistanceSource | null;
  afterSource?: DistanceSource | null;
  fenBefore?: string;
  fenAfter?: string;
  san?: string;
};

export type GradeInput = {
  outcome: GradeOutcome;
  objective: 'WIN' | 'DRAW';
  userMoves: number;
  /**
   * Ignored. Kept so older callers cannot silently revive a target based on
   * the starting distance. The path is `decisions`.
   */
  initialMatePlies?: number | null;
  mechanism?: { demonstrated: boolean; slackMoves: number } | null;
  /** Pawn-win promotion path, or elementary-mate drive when DTM is missing. */
  progress?: { demonstrated: boolean; slackMoves: number } | null;
  decisions?: GradeDecision[];
};

export type ScoredAttempt = {
  outcome: AttemptOutcome;
  userMoves?: number;
  scoreScale?: ScoreScaleId;
  attemptScore?: number | null;
  gradeConfidence?: GradeConfidence;
};

const EMPTY_GRADE = (
  reason: QualityGrade['reason'],
  commentFr: string,
  commentEn: string,
  score: number | null = null,
): QualityGrade => ({
  scale: 'quality-5',
  version: QUALITY_SCORE_VERSION,
  score,
  reason,
  extra: null,
  commentFr,
  commentEn,
});

/** Map a non-negative detour count onto the half-point scale. Success only. */
export function gradeFromExtra(extra: number): number {
  const e = Math.max(0, Math.floor(extra));
  if (e <= 0) return 5;
  if (e === 1) return 4.5;
  if (e === 2) return 4;
  if (e <= 4) return 3.5;
  if (e <= 6) return 3;
  if (e <= 8) return 2.5;
  if (e <= 12) return 2;
  if (e <= 16) return 1.5;
  return 1;
}

function commentForExtra(extra: number, kind: 'mate' | 'mechanism' | 'progress'): { fr: string; en: string } {
  const n = Math.max(0, Math.floor(extra));
  if (n <= 0) {
    return kind === 'mate'
      ? {
          fr: 'Réalisation maîtrisée et efficace : la distance de mat exacte est respectée.',
          en: 'Mastered and efficient: the exact mate distance is met.',
        }
      : kind === 'progress'
        ? {
            fr: 'Réalisation maîtrisée : le gain est tenu et la promotion gagnante est préparée sans détour.',
            en: 'Mastered: the win is kept and the winning promotion is prepared without slack.',
          }
        : {
            fr: 'Réalisation maîtrisée et efficace : le mécanisme est tenu sans imprécision.',
            en: 'Mastered and efficient: the mechanism is kept without slack.',
          };
  }
  const frUnit = kind === 'mate' ? 'temps' : n > 1 ? 'coups' : 'coup';
  const enUnit = kind === 'mate' ? (n > 1 ? 'tempos' : 'tempo') : n > 1 ? 'moves' : 'move';
  const perdu = n > 1 ? 'perdus' : 'perdu';
  if (n <= 2) {
    return {
      fr: `Bonne maîtrise, quelques détours (${n} ${frUnit} ${perdu} sur les positions rencontrées).`,
      en: `Very good control, small detours (${n} ${enUnit} lost on the positions actually faced).`,
    };
  }
  if (n <= 6) {
    return {
      fr: `Bonne réalisation, plusieurs détours (${n} ${frUnit} ${perdu} sur les positions rencontrées).`,
      en: `Good play, several detours (${n} ${enUnit} lost on the positions actually faced).`,
    };
  }
  if (n <= 12) {
    return {
      fr: `Méthode fragile (${n} ${frUnit} ${perdu} sur les positions rencontrées).`,
      en: `Fragile method (${n} ${enUnit} lost on the positions actually faced).`,
    };
  }
  return {
    fr: `Objectif atteint avec beaucoup de détours (${n} ${frUnit} ${perdu} sur les positions rencontrées).`,
    en: `Objective reached with many detours (${n} ${enUnit} lost on the positions actually faced).`,
  };
}

function matePathExtra(
  decisions: GradeDecision[] | undefined,
): { extra: number } | { missing: true } {
  if (!decisions || decisions.length === 0) return { missing: true };
  let waste = 0;
  for (const decision of decisions) {
    const before = decision.dtmBefore;
    const after = decision.dtmAfter;
    if (before == null || after == null) return { missing: true };
    if (!Number.isInteger(before) || !Number.isInteger(after) || before < 0 || after < 0) {
      return { missing: true };
    }
    waste += wastedPlies(before, after);
  }
  return { extra: Math.ceil(waste / 2) };
}

function countRecoveries(
  objective: 'WIN' | 'DRAW',
  decisions: GradeDecision[] | undefined,
): { dips: number; missing: boolean } {
  if (!decisions || decisions.length === 0) return { dips: 0, missing: false };
  let down = false;
  let dips = 0;
  for (const d of decisions) {
    if (d.resultAfterReply == null) return { dips: 0, missing: true };
    const keeps =
      objective === 'WIN' ? d.resultAfterReply === 'WIN' : d.resultAfterReply !== 'LOSS';
    if (!keeps) down = true;
    else if (down) {
      dips += 1;
      down = false;
    }
  }
  if (down) dips += 1;
  return { dips, missing: false };
}

export function gradeQuality(input: GradeInput): QualityGrade {
  if (input.outcome === 'abandoned') {
    return EMPTY_GRADE(
      'abandoned',
      'Tentative abandonnée, sans note.',
      'Attempt abandoned, no grade.',
    );
  }
  if (input.outcome === 'interrupted' || input.outcome === 'in-progress') {
    return EMPTY_GRADE(
      'interrupted',
      'Tentative interrompue, sans note.',
      'Attempt interrupted, no grade.',
    );
  }
  if (input.outcome === 'theoretical-loss') {
    return {
      scale: 'quality-5',
      version: QUALITY_SCORE_VERSION,
      score: 0,
      reason: 'failed',
      extra: null,
      commentFr: 'Objectif échoué.',
      commentEn: 'Objective failed.',
    };
  }

  const recovery = countRecoveries(input.objective, input.decisions);
  // A missing result trace must not invent dips. It also must not invent a mate distance.
  const dipPenalty = recovery.missing ? 0 : recovery.dips * 4;

  if (input.objective === 'WIN') {
    const path = matePathExtra(input.decisions);
    if (!('missing' in path)) {
      const extra = path.extra + dipPenalty;
      const text = commentForExtra(extra, 'mate');
      return {
        scale: 'quality-5',
        version: QUALITY_SCORE_VERSION,
        score: gradeFromExtra(extra),
        reason: 'mate-distance',
        extra,
        commentFr: text.fr,
        commentEn: text.en,
      };
    }
    if (input.progress?.demonstrated) {
      const extra = Math.max(0, input.progress.slackMoves) + dipPenalty;
      const text = commentForExtra(extra, 'progress');
      return {
        scale: 'quality-5',
        version: QUALITY_SCORE_VERSION,
        score: gradeFromExtra(extra),
        reason: 'progress',
        extra,
        commentFr: text.fr,
        commentEn: text.en,
      };
    }
    return EMPTY_GRADE(
      'unevaluated',
      'Qualité non évaluée.',
      'Quality not evaluated.',
    );
  }

  if (input.mechanism?.demonstrated) {
    const extra = Math.max(0, input.mechanism.slackMoves) + dipPenalty;
    const text = commentForExtra(extra, 'mechanism');
    return {
      scale: 'quality-5',
      version: QUALITY_SCORE_VERSION,
      score: gradeFromExtra(extra),
      reason: 'mechanism',
      extra,
      commentFr: text.fr,
      commentEn: text.en,
    };
  }

  return EMPTY_GRADE(
    'unevaluated',
    'Qualité non évaluée.',
    'Quality not evaluated.',
  );
}

/** @deprecated name kept for call sites. Grades on quality-5; ignores any legacy target. */
export function scoreAttempt(input: GradeInput): QualityGrade {
  return gradeQuality(input);
}

export type ThemeScoreSummary = {
  /** Average of exact and legacy quality-5 grades. Estimated grades are excluded. */
  score: number;
  count: number;
  estimatedScore: number;
  estimatedCount: number;
  /** Finished exercises, including a win whose score is still missing. */
  attemptCount: number;
  winCount: number;
};

function averageOf(values: number[]): { score: number; count: number } {
  if (values.length === 0) return { score: 0, count: 0 };
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  return { score: Math.round(avg * 10) / 10, count: values.length };
}

/** Exact grades and engine estimates stay in separate averages. */
export function summarizeAttempts(attempts: ScoredAttempt[], window = 10): ThemeScoreSummary {
  const finished = attempts.filter(
    (attempt) =>
      attempt.scoreScale === 'quality-5' &&
      (attempt.outcome === 'success' || attempt.outcome === 'theoretical-loss'),
  );
  const numeric = (attempt: ScoredAttempt) => typeof attempt.attemptScore === 'number';
  const exact = finished
    .filter((attempt) => numeric(attempt) && attempt.gradeConfidence !== 'estimated')
    .slice(0, window)
    .map((attempt) => attempt.attemptScore as number);
  const estimated = finished
    .filter((attempt) => numeric(attempt) && attempt.gradeConfidence === 'estimated')
    .slice(0, window)
    .map((attempt) => attempt.attemptScore as number);
  const exactAvg = averageOf(exact);
  const estimatedAvg = averageOf(estimated);
  return {
    score: exactAvg.score,
    count: exactAvg.count,
    estimatedScore: estimatedAvg.score,
    estimatedCount: estimatedAvg.count,
    attemptCount: finished.length,
    winCount: finished.filter((attempt) => attempt.outcome === 'success').length,
  };
}

export function averageComprehensionScore(
  attempts: ScoredAttempt[],
  window = 10,
): { score: number; count: number } {
  const scored = attempts
    .filter(
      (a) =>
        a.scoreScale === 'quality-5' &&
        (a.outcome === 'success' || a.outcome === 'theoretical-loss') &&
        typeof a.attemptScore === 'number',
    )
    .slice(0, window)
    .map((a) => a.attemptScore as number);
  if (scored.length === 0) return { score: 0, count: 0 };
  const avg = scored.reduce((s, v) => s + v, 0) / scored.length;
  return { score: Math.round(avg * 10) / 10, count: scored.length };
}

export function averageLegacyScore(
  attempts: ScoredAttempt[],
  window = 10,
): { score: number; count: number } {
  const scored = attempts
    .filter(
      (a) =>
        a.scoreScale !== 'quality-5' &&
        (a.outcome === 'success' || a.outcome === 'theoretical-loss') &&
        typeof a.attemptScore === 'number',
    )
    .slice(0, window)
    .map((a) => a.attemptScore as number);
  if (scored.length === 0) return { score: 0, count: 0 };
  const avg = scored.reduce((s, v) => s + v, 0) / scored.length;
  return { score: Math.round(avg * 10) / 10, count: scored.length };
}

/** Mastery on the current scale only: a perfect 5 average. */
export function isThemeMastered(score: number): boolean {
  return score >= 5;
}

export function formatComprehensionScore(score: number): string {
  if (Number.isInteger(score)) return `${score}/5`;
  return `${score.toFixed(1).replace('.', ',')}/5`;
}

/** A missing average is an em dash. A real 0/5 (only losses) keeps the zero. */
export function formatAverageOrDash(count: number, score: number): string {
  if (count <= 0) return '—/5';
  return formatComprehensionScore(score);
}

export function formatLegacyScore(score: number): string {
  if (Number.isInteger(score)) return `${score}/10`;
  return `${score.toFixed(1).replace('.', ',')}/10`;
}

export function formatDuration(ms: number): { fr: string; en: string } {
  const total = Math.max(0, Math.round(ms / 1000));
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min <= 0) return { fr: `${sec} s`, en: `${sec} s` };
  return { fr: `${min} min ${sec} s`, en: `${min} min ${sec} s` };
}

export function headlineFor(input: {
  score: number | null;
  outcome: AttemptOutcome;
  objective: 'WIN' | 'DRAW';
  objectiveKind?: string;
  lang: 'fr' | 'en';
}): string {
  if (input.outcome === 'abandoned' || input.outcome === 'interrupted') {
    return input.lang === 'en' ? 'Attempt stopped, no grade' : 'Tentative interrompue, sans note';
  }
  const won =
    input.outcome === 'success' &&
    (input.objective === 'WIN' || input.objectiveKind === 'promote-and-win' || input.objectiveKind === 'mate');
  const stopped = input.outcome === 'success' && input.objectiveKind === 'stop-pawn';
  const drew = input.outcome === 'success' && !won && !stopped;
  const frTitle = won
    ? 'Finale gagnée'
    : stopped
      ? 'Pion arrêté'
      : drew
        ? 'Défense réussie'
        : 'Objectif échoué';
  const enTitle = won
    ? 'Endgame won'
    : stopped
      ? 'Pawn stopped'
      : drew
        ? 'Defence held'
        : 'Objective failed';
  const title = input.lang === 'en' ? enTitle : frTitle;
  if (input.score == null) {
    if (input.outcome === 'success') {
      const bang = input.lang === 'en' ? `${enTitle}!` : `${frTitle} !`;
      return bang;
    }
    const q = input.lang === 'en' ? 'Quality not evaluated' : 'Qualité non évaluée';
    return `${q} — ${title}`;
  }
  const scoreText =
    input.lang === 'en'
      ? `${input.score}/5`
      : formatComprehensionScore(input.score);
  return `${scoreText} — ${title}`;
}
