/**
 * Coverage report for theoretical scoring: launched, finished, capped, scored.
 * A loss with 0/5 is finished, not a scored success.
 * Wins and successful defences are summarised separately: a pile of wins
 * does not prove that draw exercises are graded.
 */
import type { AnalysisStatus, GradeCause, TheoreticalObjective, TheoreticalThemeId } from '../domain/types.ts';
import { gradeFamilyFor } from '../domain/gradeFamily.ts';
import type { TrajectoryQuality } from './qualityTrajectories.ts';

export type CoverageKind = 'recorded' | 'autoplay';

export type CoverageRow = {
  themeId: TheoreticalThemeId;
  positionId: string;
  kind: CoverageKind;
  quality?: TrajectoryQuality;
  launched: true;
  objective: TheoreticalObjective;
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
  family: ReturnType<typeof gradeFamilyFor>;
  launched: number;
  finishedWon: number;
  finishedLost: number;
  capInterrupted: number;
  scoredSuccesses: number;
  scoredWins: number;
  scoredDefenses: number;
  winSuccesses: number;
  defenseSuccesses: number;
  scoredRate: number;
  playMs: number;
  gradeMs: number;
  causes: Record<string, number>;
  scores: number[];
};

export const SCORED_SUCCESS_TARGET = 0.95;

function rate(scored: number, successes: number): number {
  if (successes <= 0) return 0;
  return scored / successes;
}

export function summarizeCoverage(rows: CoverageRow[]): {
  launched: number;
  finishedWon: number;
  finishedLost: number;
  capInterrupted: number;
  scoredSuccesses: number;
  scoredWins: number;
  scoredDefenses: number;
  winSuccesses: number;
  defenseSuccesses: number;
  playMs: number;
  gradeMs: number;
  byTheme: ThemeCoverage[];
  belowTarget: TheoreticalThemeId[];
} {
  const byTheme = new Map<TheoreticalThemeId, ThemeCoverage>();
  const ensure = (themeId: TheoreticalThemeId, objective: TheoreticalObjective): ThemeCoverage => {
    let row = byTheme.get(themeId);
    if (!row) {
      row = {
        themeId,
        family: gradeFamilyFor(themeId, objective),
        launched: 0,
        finishedWon: 0,
        finishedLost: 0,
        capInterrupted: 0,
        scoredSuccesses: 0,
        scoredWins: 0,
        scoredDefenses: 0,
        winSuccesses: 0,
        defenseSuccesses: 0,
        scoredRate: 0,
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
    const theme = ensure(row.themeId, row.objective);
    theme.launched += 1;
    theme.playMs += row.playMs;
    theme.gradeMs += row.gradeMs;
    if (row.outcome === 'success') {
      theme.finishedWon += 1;
      if (row.objective === 'DRAW') theme.defenseSuccesses += 1;
      else theme.winSuccesses += 1;
    }
    if (row.outcome === 'theoretical-loss') theme.finishedLost += 1;
    if (row.capInterrupted) theme.capInterrupted += 1;
    if (row.scoredSuccess) {
      theme.scoredSuccesses += 1;
      if (row.objective === 'DRAW') theme.scoredDefenses += 1;
      else theme.scoredWins += 1;
      if (typeof row.attemptScore === 'number') theme.scores.push(row.attemptScore);
    }
    const cause = row.gradeCause ?? (row.capInterrupted ? 'cap' : row.outcome);
    theme.causes[String(cause)] = (theme.causes[String(cause)] ?? 0) + 1;
  }
  const byThemeList = [...byTheme.values()].map((theme) => ({
    ...theme,
    scoredRate: rate(theme.scoredSuccesses, theme.finishedWon),
  }));
  const winSuccesses = rows.filter((row) => row.outcome === 'success' && row.objective === 'WIN').length;
  const defenseSuccesses = rows.filter((row) => row.outcome === 'success' && row.objective === 'DRAW').length;
  return {
    launched: rows.length,
    finishedWon: rows.filter((row) => row.outcome === 'success').length,
    finishedLost: rows.filter((row) => row.outcome === 'theoretical-loss').length,
    capInterrupted: rows.filter((row) => row.capInterrupted).length,
    scoredSuccesses: rows.filter((row) => row.scoredSuccess).length,
    scoredWins: rows.filter((row) => row.scoredSuccess && row.objective === 'WIN').length,
    scoredDefenses: rows.filter((row) => row.scoredSuccess && row.objective === 'DRAW').length,
    winSuccesses,
    defenseSuccesses,
    playMs: rows.reduce((sum, row) => sum + row.playMs, 0),
    gradeMs: rows.reduce((sum, row) => sum + row.gradeMs, 0),
    byTheme: byThemeList,
    belowTarget: byThemeList
      .filter((theme) => theme.finishedWon > 0 && theme.scoredRate < SCORED_SUCCESS_TARGET)
      .map((theme) => theme.themeId),
  };
}
