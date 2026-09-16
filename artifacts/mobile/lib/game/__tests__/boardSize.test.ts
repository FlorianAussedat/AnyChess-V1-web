/**
 * Shared board footprint sizing (default vs wide).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
  DEFAULT_BOARD_MAX_SIZE,
  MIN_BOARD_SIZE,
} from '../boardSize.ts';

describe('computeBoardSize', () => {
  it('default mode preserves historical compact formula', () => {
    assert.equal(computeBoardSize(390), Math.min(390 - 20, DEFAULT_BOARD_MAX_SIZE));
    assert.equal(computeBoardSize(500), DEFAULT_BOARD_MAX_SIZE);
    assert.equal(computeBoardSize(300), 280);
  });

  it('wide mode uses ~94–96% of screen width with small side margins', () => {
    const w = 390;
    const size = computeBoardSize(w, 'wide');
    const ratio = size / w;
    assert.ok(ratio >= 0.94 && ratio <= 0.96, `ratio=${ratio}`);
    assert.equal(size, w - 2 * Math.max(8, Math.round(w * 0.025)));
  });

  it('wide mode stays square-compatible and larger than default on phones', () => {
    for (const w of [320, 360, 390, 430]) {
      const wide = computeBoardSize(w, 'wide');
      const def = computeBoardSize(w, 'default');
      assert.ok(wide >= def);
      assert.ok(wide >= MIN_BOARD_SIZE);
      assert.ok(wide + 16 <= w + 0.5, 'fits with >=8px margins');
    }
  });

  it('explicit modes do not collide — default stays capped', () => {
    assert.equal(computeBoardSize(800, 'default'), DEFAULT_BOARD_MAX_SIZE);
    assert.ok(computeBoardSize(800, 'wide') > DEFAULT_BOARD_MAX_SIZE);
  });
});

describe('fitBoardSizeToViewport', () => {
  it('never exceeds width-based size or drops below MIN_BOARD_SIZE', () => {
    const wide = computeBoardSize(360, 'wide');
    const fitted = fitBoardSizeToViewport(wide, 700, 400);
    assert.ok(fitted <= wide);
    assert.ok(fitted >= MIN_BOARD_SIZE);
  });
});
