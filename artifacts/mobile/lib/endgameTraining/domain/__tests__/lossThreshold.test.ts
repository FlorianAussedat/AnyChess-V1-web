/**
 * Loss threshold boundary tests (−2.00 = −200 cp).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { crossesLossThreshold } from '../AttemptScoring.ts';
import { verifyLoss } from '../../engine/LossVerifier.ts';

describe('loss threshold −200 cp', () => {
  it('−199 cp does not cross', () => {
    assert.equal(crossesLossThreshold(-199), false);
  });

  it('−200 cp does not cross (exactly −2.00 continues)', () => {
    assert.equal(crossesLossThreshold(-200), false);
  });

  it('−201 cp crosses', () => {
    assert.equal(crossesLossThreshold(-201), true);
  });

  it('−201 confirmed → loss', () => {
    const v = verifyLoss(
      { scoreCp: -201, mateIn: null },
      { scoreCp: -210, mateIn: null },
    );
    assert.equal(v.lost, true);
  });

  it('−201 not confirmed → continue', () => {
    const v = verifyLoss(
      { scoreCp: -201, mateIn: null },
      { scoreCp: -150, mateIn: null },
    );
    assert.equal(v.lost, false);
    assert.equal(v.reason, 'recovered');
  });

  it('mate against player → immediate loss', () => {
    const v = verifyLoss({ scoreCp: 0, mateIn: -3 }, null);
    assert.equal(v.lost, true);
    assert.equal(v.reason, 'mate');
  });
});
