import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampEvalForCurve,
  formatAnyLyseurEval,
  whiteAdvantageRatio,
} from '../formatEval.ts';
import {
  sideToMoveFromFen,
  stmCpToWhite,
  stmMateToWhite,
  toWhiteScore,
} from '../scoreWhite.ts';

describe('formatAnyLyseurEval', () => {
  it('formats cp and mate White-centric', () => {
    assert.equal(formatAnyLyseurEval({ cp: 0, mate: null }), '+0.00');
    assert.equal(formatAnyLyseurEval({ cp: 85, mate: null }), '+0.85');
    assert.equal(formatAnyLyseurEval({ cp: -142, mate: null }), '-1.42');
    assert.equal(formatAnyLyseurEval({ cp: null, mate: 3 }), 'M3');
    assert.equal(formatAnyLyseurEval({ cp: null, mate: -2 }), '-M2');
  });

  it('clamps curve mates without converting to 999', () => {
    assert.equal(clampEvalForCurve({ cp: null, mate: 4 }, 8), 8);
    assert.equal(clampEvalForCurve({ cp: null, mate: -3 }, 8), -8);
    assert.ok(whiteAdvantageRatio({ cp: 0, mate: null }) === 0.5);
  });
});

describe('toWhiteScore', () => {
  const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const blackToMove = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

  it('keeps STM scores when White to move', () => {
    assert.equal(sideToMoveFromFen(start), 'w');
    assert.deepEqual(toWhiteScore({ scoreCp: 40, mateIn: null }, start), {
      evaluation: 40,
      mate: null,
    });
    assert.equal(stmMateToWhite(2, 'w'), 2);
  });

  it('flips STM scores when Black to move', () => {
    assert.equal(sideToMoveFromFen(blackToMove), 'b');
    assert.equal(stmCpToWhite(35, 'b'), -35);
    assert.deepEqual(toWhiteScore({ scoreCp: 35, mateIn: null }, blackToMove), {
      evaluation: -35,
      mate: null,
    });
    assert.deepEqual(toWhiteScore({ scoreCp: 0, mateIn: 3 }, blackToMove), {
      evaluation: null,
      mate: -3,
    });
  });
});
