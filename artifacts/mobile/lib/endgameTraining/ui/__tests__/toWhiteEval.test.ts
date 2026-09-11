/**
 * Defender-POV → white-centric eval helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  defenderToWhiteEval,
  timelineToEvalCurvePoints,
} from '../toWhiteEval.ts';
import type { EvaluationPoint } from '../../domain/types.ts';

describe('defenderToWhiteEval', () => {
  it('keeps scores when defender is white', () => {
    assert.deepEqual(defenderToWhiteEval(-80, null, 'white'), {
      cp: -80,
      mate: null,
    });
    assert.deepEqual(defenderToWhiteEval(50, 3, 'white'), {
      cp: 50,
      mate: 3,
    });
  });

  it('negates when defender is black', () => {
    assert.deepEqual(defenderToWhiteEval(-80, null, 'black'), {
      cp: 80,
      mate: null,
    });
    assert.deepEqual(defenderToWhiteEval(100, -2, 'black'), {
      cp: -100,
      mate: 2,
    });
  });
});

describe('timelineToEvalCurvePoints', () => {
  it('maps timeline to EvalCurvePoint with white-centric evaluation', () => {
    const timeline: EvaluationPoint[] = [
      {
        afterPlayerMove: 0,
        playerMoveNumber: 0,
        fen: '4k3/8/8/8/8/8/8/4K3 w - - 0 1',
        scoreCp: -40,
        mateIn: null,
      },
      {
        afterPlayerMove: 1,
        playerMoveNumber: 1,
        fen: '4k3/8/8/8/8/8/8/3K4 b - - 1 1',
        scoreCp: -120,
        mateIn: null,
        san: 'Kd1',
      },
    ];
    const pts = timelineToEvalCurvePoints(timeline, 'black');
    assert.equal(pts.length, 2);
    assert.equal(pts[0]!.analysis.evaluation, 40);
    assert.equal(pts[1]!.analysis.evaluation, 120);
    assert.equal(pts[0]!.nodeId, 'endgame-0-0');
  });
});
