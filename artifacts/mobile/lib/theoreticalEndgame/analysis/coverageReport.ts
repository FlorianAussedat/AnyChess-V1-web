/**
 * Coverage report for theoretical scoring: launched, finished, capped, scored.
 * A loss with 0/5 is finished, not a scored success.
 */
import type { AnalysisStatus, GradeCause, TheoreticalThemeId } from '../domain/types.ts';
import type { TrajectoryQuality } from './qualityTrajectories.ts';

export type CoverageKind = 'recorded' | 'autoplay';

export type CoverageRow = {
  themeId: TheoreticalThemeId;
  positionId: string;
  kind: CoverageKind;
  quality?: TrajectoryQuality;
  launched: true;
  outcome: 'success' | 'theoretical-loss' | 'interrupted' | 'unfinished';
  capInterrupted: boolean;
  scoredSuccess: boolean;
  attemptScore: number | null;
  analysisStatus: AnalysisStatus | 'not-started';
  gradeCause: GradeCause | string | null;
  playMs: number;
  gradeMs: number;
  userMoves: number;
};

export type ThemeCoverage = {
  themeId: TheoreticalThemeId;
  launched: number;
  finishedWon: number;
  finishedLost: number;
  capInterrupted: number;
  scoredSuccesses: number;
  playMs: number;
  gradeMs: number;
  causes: Record<string, number>;
  scores: number[];
};

export function summarizeCoverage(rows: CoverageRow[]): {
  launched: number;
  finishedWon: number;
  finishedLost: number;
  capInterrupted: number;
  scoredSuccesses: number;
  playMs: number;
  gradeMs: number;
  byTheme: ThemeCoverage[];
} {
  const byTheme = new Map<TheoreticalThemeId, ThemeCoverage>();
  const ensure = (themeId: TheoreticalThemeId): ThemeCoverage => {
    let row = byTheme.get(themeId);
    if (!row) {
      row = {
        themeId,
        launched: 0,
        finishedWon: 0,
        finishedLost: 0,
        capInterrupted: 0,
        scoredSuccesses: 0,
        playMs: 0,
        gradeMs: 0,
        causes: {},
        scores: [],
      };
      byTheme.set(themeId, row);
    }
    return row;
  };
  for (const row of rows) {
    const theme = ensure(row.themeId);
    theme.launched += 1;
    theme.playMs += row.playMs;
    theme.gradeMs += row.gradeMs;
    if (row.outcome === 'success') theme.finishedWon += 1;
    if (row.outcome === 'theoretical-loss') theme.finishedLost += 1;
    if (row.capInterrupted) theme.capInterrupted += 1;
    if (row.scoredSuccess) {
      theme.scoredSuccesses += 1;
      if (typeof row.attemptScore === 'number') theme.scores.push(row.attemptScore);
    }
    const cause = row.gradeCause ?? (row.capInterrupted ? 'cap' : row.outcome);
    theme.causes[String(cause)] = (theme.causes[String(cause)] ?? 0) + 1;
  }
  return {
    launched: rows.length,
    finishedWon: rows.filter((row) => row.outcome === 'success').length,
    finishedLost: rows.filter((row) => row.outcome === 'theoretical-loss').length,
    capInterrupted: rows.filter((row) => row.capInterrupted).length,
    scoredSuccesses: rows.filter((row) => row.scoredSuccess).length,
    playMs: rows.reduce((sum, row) => sum + row.playMs, 0),
    gradeMs: rows.reduce((sum, row) => sum + row.gradeMs, 0),
    byTheme: [...byTheme.values()],
  };
}
