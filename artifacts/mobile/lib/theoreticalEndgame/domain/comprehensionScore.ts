/**
 * Theoretical endgame grade — scale quality-5 (theoretical-quality-v1).
 *
 * Unit: a "coup" is one move by the user, from their side. It is not a ply
 * and not a full move (White+Black). Time and the old target-move count are
 * not inputs.
 *
 * Failure is 0. Abandon and technical interruption have no grade.
 * A success is 1, 1.5, …, 5. Half-points are the only fractions.
 * 0 is never used for a success.
 *
 * Two different measurements, never mixed into a centipawn conversion:
 *
 * 1. Exact mate distance (Syzygy DTM, plies, user to move at the start).
 *    Minimum user moves = ceil(DTM / 2). That is the shortest win against
 *    perfect defence, not a stored pedagogical target.
 *    extra = max(0, userMoves - minimum) + 4 per temporary loss of the
 *    result that was later recovered.
 *    Several moves that keep the same DTM all score 5. A different winning
 *    method that is longer scores the extra moves only.
 *
 * 2. Theme mechanism (draws and fortresses). Slack counts user moves that
 *    leave the demonstrated idea (barrier, lateral rook, saving corner,
 *    checking distance). A repetition that keeps the idea is not slack.
 *    A regulatory draw that never shows the idea scores 2 (fragile), not 5.
 *
 * If neither exact DTM nor a mechanism measurement is available, the score
 * is null and the comment is "Qualité non évaluée". The objective result is
 * still reported. Missing data is never filled with 5.
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
import type { AttemptOutcome, QualityGrade, ScoreScaleId } from './types.ts';

export const QUALITY_SCORE_VERSION = 'theoretical-quality-v1' as const;

export type GradeOutcome = AttemptOutcome;

export type GradeDecision = {
  resultAfterReply: 'WIN' | 'DRAW' | 'LOSS' | null;
};

export type GradeInput = {
  outcome: GradeOutcome;
  objective: 'WIN' | 'DRAW';
  userMoves: number;
  initialMatePlies: number | null;
  mechanism?: { demonstrated: boolean; slackMoves: number } | null;
  decisions?: GradeDecision[];
};

export type ScoredAttempt = {
  outcome: AttemptOutcome;
  userMoves?: number;
  scoreScale?: ScoreScaleId;
  attemptScore?: number | null;
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

function commentForExtra(extra: number, kind: 'mate' | 'mechanism'): { fr: string; en: string } {
  const n = Math.max(0, Math.floor(extra));
  if (n <= 0) {
    return kind === 'mate'
      ? {
          fr: 'Réalisation maîtrisée et efficace : la distance de mat exacte est respectée.',
          en: 'Mastered and efficient: the exact mate distance is met.',
        }
      : {
          fr: 'Réalisation maîtrisée et efficace : le mécanisme est tenu sans imprécision.',
          en: 'Mastered and efficient: the mechanism is kept without slack.',
        };
  }
  if (n <= 2) {
    return {
      fr: `Bonne maîtrise, quelques détours (${n} coup${n > 1 ? 's' : ''} de plus que la mesure exacte).`,
      en: `Very good control, small detours (${n} move${n > 1 ? 's' : ''} beyond the exact measure).`,
    };
  }
  if (n <= 6) {
    return {
      fr: `Bonne réalisation, plusieurs détours (${n} coups de plus que la mesure exacte).`,
      en: `Good play, several detours (${n} moves beyond the exact measure).`,
    };
  }
  if (n <= 12) {
    return {
      fr: `Méthode fragile (${n} coups de plus que la mesure exacte).`,
      en: `Fragile method (${n} moves beyond the exact measure).`,
    };
  }
  return {
    fr: `Objectif atteint avec beaucoup de détours (${n} coups de plus que la mesure exacte).`,
    en: `Objective reached with many detours (${n} moves beyond the exact measure).`,
  };
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
  // An incomplete trace must not erase an exact measure, and must not invent dips.
  const dipPenalty = recovery.missing ? 0 : recovery.dips * 4;

  if (
    input.objective === 'WIN' &&
    input.initialMatePlies != null &&
    input.initialMatePlies > 0
  ) {
    const minimum = Math.ceil(input.initialMatePlies / 2);
    const extra = Math.max(0, input.userMoves - minimum) + dipPenalty;
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

  if (input.mechanism) {
    if (!input.mechanism.demonstrated) {
      const extra = 12 + dipPenalty;
      const text = commentForExtra(extra, 'mechanism');
      return {
        scale: 'quality-5',
        version: QUALITY_SCORE_VERSION,
        score: gradeFromExtra(extra),
        reason: 'draw-without-mechanism',
        extra,
        commentFr: `Nulle obtenue sans le mécanisme demandé. ${text.fr}`,
        commentEn: `Draw reached without the required mechanism. ${text.en}`,
      };
    }
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
    const q = input.lang === 'en' ? 'Quality not evaluated' : 'Qualité non évaluée';
    return `${q} — ${title}`;
  }
  const scoreText =
    input.lang === 'en'
      ? `${input.score}/5`
      : formatComprehensionScore(input.score);
  return `${scoreText} — ${title}`;
}
