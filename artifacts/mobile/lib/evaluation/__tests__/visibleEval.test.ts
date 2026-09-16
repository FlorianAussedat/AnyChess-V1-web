/**
 * Tests — universal visible evaluation (−10/+10, mate, perspective).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampVisibleCp,
  computeVisibleEval,
  formatMateLabel,
  formatVisiblePawns,
  gaugeFillRatioForBand,
  toPerspectiveCp,
  visiblePawnsFromCp,
} from '../visibleEval.ts';

describe('visibleEval clamp −10/+10', () => {
  it('clamps +1620 cp to +10.00 visible', () => {
    const v = computeVisibleEval({
      scoreCp: 1620,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(v.visibleCp, 1000);
    assert.equal(v.visiblePawns, 10);
    assert.equal(formatVisiblePawns(v.visiblePawns), '+10.00');
  });

  it('clamps −1480 cp to −10.00 visible', () => {
    const v = computeVisibleEval({
      scoreCp: -1480,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(v.visibleCp, -1000);
    assert.equal(formatVisiblePawns(v.visiblePawns), '−10.00');
  });

  it('shows −0.73 for −73 cp', () => {
    const v = computeVisibleEval({
      scoreCp: -73,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(formatVisiblePawns(v.visiblePawns), '−0.73');
  });

  it('shows −2.00 for −200 cp', () => {
    const v = computeVisibleEval({
      scoreCp: -200,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(formatVisiblePawns(v.visiblePawns), '−2.00');
  });
});

describe('visibleEval mate notation', () => {
  it('formats M17 and −M17', () => {
    assert.equal(formatMateLabel(17), 'M17');
    assert.equal(formatMateLabel(-17), '−M17');
  });

  it('never converts mate to ±10', () => {
    const v = computeVisibleEval({
      scoreCp: 0,
      mateIn: 17,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(v.mateLabel, 'M17');
    assert.notEqual(formatVisiblePawns(v.visiblePawns), '+10.00');
  });

  it('inverts mate when STM differs from perspective', () => {
    const v = computeVisibleEval({
      scoreCp: 0,
      mateIn: 3,
      perspective: 'black',
      sideToMove: 'w',
      scoreIsPerspectivePov: false,
    });
    assert.equal(v.mateIn, -3);
    assert.equal(v.mateLabel, '−M3');
  });
});

describe('visibleEval perspective', () => {
  it('inverts cp when sideToMove is opponent', () => {
    const norm = toPerspectiveCp({
      scoreCp: 150,
      perspective: 'white',
      sideToMove: 'b',
      scoreIsPerspectivePov: false,
    });
    assert.equal(norm.scoreCp, -150);
  });

  it('keeps cp when sideToMove matches perspective', () => {
    const norm = toPerspectiveCp({
      scoreCp: 150,
      perspective: 'white',
      sideToMove: 'w',
      scoreIsPerspectivePov: false,
    });
    assert.equal(norm.scoreCp, 150);
  });
});

describe('gaugeFillRatioForBand', () => {
  it('maps pressure band −200…0', () => {
    assert.equal(gaugeFillRatioForBand(0, -200, 0), 1);
    assert.equal(gaugeFillRatioForBand(-200, -200, 0), 0);
    assert.equal(gaugeFillRatioForBand(-100, -200, 0), 0.5);
  });
});

describe('raw vs visible for decisions', () => {
  it('preserves rawPerspectiveCp beyond clamp', () => {
    const v = computeVisibleEval({
      scoreCp: -2500,
      perspective: 'white',
      scoreIsPerspectivePov: true,
    });
    assert.equal(v.rawPerspectiveCp, -2500);
    assert.equal(v.visibleCp, -1000);
  });
});
