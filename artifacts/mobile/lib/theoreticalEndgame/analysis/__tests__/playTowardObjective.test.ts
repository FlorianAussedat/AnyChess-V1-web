import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getPositionById } from '../../selection/selectors.ts';
import {
  pickDefenseUserSan,
  playCapFor,
  replayRecordedLine,
} from '../playTowardObjective.ts';
import {
  QUALITY_TRAJECTORIES,
  RECORDED_START_FEN,
} from '../qualityTrajectories.ts';
import { gradeQuality } from '../../domain/comprehensionScore.ts';
import { assessDefense } from '../../domain/defenseFinish.ts';
import { pickPawnWinUserSan } from '../../domain/pawnWinProgress.ts';
import { referenceGrade } from '../referenceGrade.ts';
import type { TheoreticalEndgamePosition } from '../../domain/types.ts';

function recordedPosition(trajectory: (typeof QUALITY_TRAJECTORIES)[number]): TheoreticalEndgamePosition {
  const fen = RECORDED_START_FEN[trajectory.positionId];
  if (fen) {
    return {
      id: trajectory.positionId,
      themeId: trajectory.themeId,
      initialFen: fen,
      playerColor: 'white',
      objective: 'WIN',
      objectiveKind: 'mate',
      completion: { type: 'CHECKMATE' },
      certification: { type: 'SYZYGY', result: 'WIN' },
      proof: {
        method: 'syzygy-7',
        confidence: 'exact',
        category: 'win',
        playerResult: 'WIN',
        dtz: 1,
        dtm: 1,
        dtmReported: 1,
        source: 'lichess-syzygy',
        consultedAt: '2026-10-13',
      },
      contentVersion: 'variants-v2',
      variantNote: { fr: '', en: '' },
      diagramOrientation: 'white',
      tags: [],
      active: true,
      explanation: {
        fr: { principle: '', seek: '', method: '', avoid: '' },
        en: { principle: '', seek: '', method: '', avoid: '' },
      },
    };
  }
  const catalog = getPositionById(trajectory.positionId);
  assert.ok(catalog, trajectory.positionId);
  return catalog!;
}

describe('play toward the exercise objective', () => {
  it('gives the two bishops a cap that can finish a DTM-33 mate', () => {
    const bishops = getPositionById('TE-CANON-TWO-BISHOPS-MATE');
    assert.ok(bishops);
    assert.ok((bishops!.proof.dtm ?? 0) >= 33);
    assert.ok(playCapFor(bishops!) >= 36);
    assert.ok(playCapFor(bishops!) > 20);
  });

  it('picks a legal user move that completes a draw mechanism', () => {
    const philidor = getPositionById('TE-CANON-PHILIDOR');
    assert.ok(philidor);
    const san = pickDefenseUserSan(philidor!, []);
    assert.ok(san);
    const defense = assessDefense({
      themeId: 'philidor',
      initialFen: philidor!.initialFen,
      sans: [san!],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(defense.complete, true);
  });

  it('replays recorded lines and keeps an efficient draw above a detour', () => {
    const byTheme = new Map<string, { efficient?: number; detour?: number }>();
    for (const trajectory of QUALITY_TRAJECTORIES) {
      const position = recordedPosition(trajectory);
      const graded = referenceGrade(position, [...trajectory.sans]);
      assert.equal(
        graded.played.outcome,
        'success',
        `${trajectory.id} ${graded.played.cause} ${graded.played.sans.join(' ')}`,
      );
      if (graded.family !== 'defense' && graded.family !== 'pawn-win') continue;
      assert.equal(typeof graded.score, 'number', trajectory.id);
      const slot = byTheme.get(trajectory.themeId) ?? {};
      if (trajectory.quality === 'efficient') {
        slot.efficient = Math.max(slot.efficient ?? 0, graded.score ?? 0);
      } else if (trajectory.quality === 'detour') slot.detour = graded.score ?? undefined;
      byTheme.set(trajectory.themeId, slot);
    }
    assert.ok((byTheme.get('philidor')?.efficient ?? 0) > (byTheme.get('philidor')?.detour ?? 0));
    assert.ok((byTheme.get('vancura')?.efficient ?? 0) > (byTheme.get('vancura')?.detour ?? 0));
    assert.equal(byTheme.get('philidor')?.efficient, 5);
    assert.ok((byTheme.get('kp-vs-k')?.efficient ?? 0) > (byTheme.get('kp-vs-k')?.detour ?? 0));
    assert.ok((byTheme.get('lucena')?.efficient ?? 0) > (byTheme.get('lucena')?.detour ?? 0));
  });

  it('picks b6 on the catalog breakthrough', () => {
    const position = getPositionById('TE-CANON-PAWN-BREAKTHROUGH');
    assert.ok(position);
    const san = pickPawnWinUserSan({
      themeId: position!.themeId,
      initialFen: position!.initialFen,
      sans: [],
      playerColor: position!.playerColor,
      objective: 'WIN',
    });
    assert.equal(san, 'b6');
  });

  it('distinguishes a mate-in-one from the same mate with a detour', () => {
    const efficient = gradeQuality({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 1,
      decisions: [{ dtmBefore: 1, dtmAfter: 0 }],
    });
    const detour = gradeQuality({
      outcome: 'success',
      objective: 'WIN',
      userMoves: 2,
      decisions: [
        { dtmBefore: 1, dtmAfter: 2 },
        { dtmBefore: 1, dtmAfter: 0 },
      ],
    });
    assert.equal(efficient.score, 5);
    assert.ok((detour.score ?? 0) < 5);
    assert.ok((detour.extra ?? 0) > (efficient.extra ?? 0));
  });
});
