import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { THEME_IDS } from '../../domain/themes.ts';
import { gradeFamilyFor } from '../../domain/gradeFamily.ts';
import { getPositionById } from '../../selection/selectors.ts';
import { QUALITY_TRAJECTORIES, RECORDED_START_FEN } from '../qualityTrajectories.ts';
import { referenceGrade } from '../referenceGrade.ts';
import { summarizeCoverage, SCORED_SUCCESS_TARGET, type CoverageRow } from '../coverageReport.ts';
import type { TheoreticalEndgamePosition } from '../../domain/types.ts';

function recordedPosition(trajectory: (typeof QUALITY_TRAJECTORIES)[number]): TheoreticalEndgamePosition {
  const fen = RECORDED_START_FEN[trajectory.positionId];
  if (fen) {
    const catalog = getPositionById(trajectory.positionId);
    return {
      ...(catalog ?? getPositionById('TE-CANON-QUEEN-MATE')!),
      id: trajectory.positionId,
      themeId: trajectory.themeId,
      initialFen: fen,
      playerColor: 'white',
      objective: 'WIN',
      objectiveKind: 'mate',
    };
  }
  const catalog = getPositionById(trajectory.positionId);
  assert.ok(catalog, trajectory.positionId);
  return catalog!;
}

describe('reference grades of recorded trajectories', () => {
  it('scores every recorded success and ranks efficient lines above detours in every family', () => {
    const rows: CoverageRow[] = [];
    const byTheme = new Map<string, { efficient?: number; detour?: number; recovered?: number; family: string }>();
    for (const trajectory of QUALITY_TRAJECTORIES) {
      const position = recordedPosition(trajectory);
      const graded = referenceGrade(position, [...trajectory.sans]);
      assert.equal(
        graded.played.outcome,
        'success',
        `${trajectory.id} ${graded.played.cause} ${graded.played.sans.join(' ')}`,
      );
      const scored = typeof graded.score === 'number';
      assert.equal(scored, true, `${trajectory.id} demonstrated=${graded.demonstrated}`);
      rows.push({
        themeId: position.themeId,
        positionId: position.id,
        kind: 'recorded',
        quality: trajectory.quality,
        launched: true,
        objective: position.objective,
        outcome: 'success',
        capInterrupted: false,
        scoredSuccess: scored,
        attemptScore: graded.score,
        analysisStatus: scored ? 'scored' : 'failed',
        gradeCause: null,
        playMs: 0,
        gradeMs: 0,
        userMoves: graded.played.userMoves,
      });
      const slot = byTheme.get(trajectory.themeId) ?? { family: graded.family };
      if (trajectory.quality === 'efficient') {
        slot.efficient = Math.max(slot.efficient ?? 0, graded.score ?? 0);
      }
      if (trajectory.quality === 'detour') slot.detour = graded.score ?? undefined;
      if (trajectory.quality === 'recovered') slot.recovered = graded.score ?? undefined;
      byTheme.set(trajectory.themeId, slot);
    }

    const report = summarizeCoverage(rows);
    assert.equal(report.finishedWon, QUALITY_TRAJECTORIES.length);
    assert.equal(report.scoredSuccesses, QUALITY_TRAJECTORIES.length);
    assert.ok(report.scoredDefenses >= 10, `scoredDefenses=${report.scoredDefenses}`);
    assert.ok(report.scoredWins >= 10, `scoredWins=${report.scoredWins}`);
    assert.notEqual(report.scoredDefenses, report.scoredWins);
    for (const themeId of THEME_IDS) {
      const theme = report.byTheme.find((row) => row.themeId === themeId);
      assert.ok(theme, themeId);
      assert.ok(theme!.finishedWon > 0, themeId);
      assert.ok(
        theme!.scoredRate >= SCORED_SUCCESS_TARGET,
        `${themeId} scoredRate=${theme!.scoredRate} ${JSON.stringify(theme!.scores)}`,
      );
    }
    assert.equal(report.belowTarget.length, 0, `belowTarget=${report.belowTarget.join(',')}`);

    assert.ok((byTheme.get('philidor')?.efficient ?? 0) > (byTheme.get('philidor')?.detour ?? 0));
    assert.ok((byTheme.get('vancura')?.efficient ?? 0) > (byTheme.get('vancura')?.detour ?? 0));
    assert.ok((byTheme.get('kp-vs-k')?.efficient ?? 0) > (byTheme.get('kp-vs-k')?.detour ?? 0));
    assert.ok((byTheme.get('lucena')?.efficient ?? 0) > (byTheme.get('lucena')?.detour ?? 0));
    assert.ok((byTheme.get('queen-vs-pawn')?.efficient ?? 0) > (byTheme.get('queen-vs-pawn')?.detour ?? 0));
    assert.ok((byTheme.get('pawn-breakthrough')?.efficient ?? 0) > (byTheme.get('pawn-breakthrough')?.detour ?? 0));
    assert.ok((byTheme.get('pawn-square')?.efficient ?? 0) > (byTheme.get('pawn-square')?.detour ?? 0));
    assert.ok(
      (byTheme.get('queen-mate')?.efficient ?? 0) > (byTheme.get('queen-mate')?.detour ?? 0),
      `queen-mate efficient=${byTheme.get('queen-mate')?.efficient} detour=${byTheme.get('queen-mate')?.detour}`,
    );
    assert.ok(
      (byTheme.get('rook-mate')?.efficient ?? 0) > (byTheme.get('rook-mate')?.detour ?? 0),
      `rook-mate efficient=${byTheme.get('rook-mate')?.efficient} detour=${byTheme.get('rook-mate')?.detour}`,
    );
    assert.ok(
      (byTheme.get('two-bishops-mate')?.efficient ?? 0) > (byTheme.get('two-bishops-mate')?.detour ?? 0),
      `two-bishops efficient=${byTheme.get('two-bishops-mate')?.efficient} detour=${byTheme.get('two-bishops-mate')?.detour}`,
    );
    const philidorRecovered = byTheme.get('philidor')?.recovered;
    assert.ok(typeof philidorRecovered === 'number');
    assert.ok((philidorRecovered ?? 5) <= (byTheme.get('philidor')?.efficient ?? 0));
    assert.equal(gradeFamilyFor('queen-mate', 'WIN'), 'elementary-mate');
    assert.equal(gradeFamilyFor('lucena', 'WIN'), 'pawn-win');
    assert.equal(gradeFamilyFor('philidor', 'DRAW'), 'defense');
  });
});
