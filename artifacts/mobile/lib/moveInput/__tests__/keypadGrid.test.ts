/**
 * Fixed 6-column chess keypad geometry.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  KEYPAD_COLUMNS,
  keypadCellWidth,
  keypadSpanWidth,
} from '../keypadGrid.ts';

describe('keypadGrid 6-column math', () => {
  it('splits available width into equal cells with identical gaps', () => {
    const gap = 3;
    const available = 360;
    const cell = keypadCellWidth(available, gap, KEYPAD_COLUMNS);
    assert.equal(KEYPAD_COLUMNS, 6);
    // 5 gaps × 3 = 15 → (360 - 15) / 6 = 57.5
    assert.equal(cell, 57.5);
    // Six cells + five gaps reconstruct the row exactly.
    assert.equal(cell * 6 + gap * 5, available);
  });

  it('spans 2 / 3 columns including interstitial gaps', () => {
    const gap = 3;
    const cell = 57.5;
    assert.equal(keypadSpanWidth(cell, gap, 1), cell);
    assert.equal(keypadSpanWidth(cell, gap, 2), cell * 2 + gap);
    assert.equal(keypadSpanWidth(cell, gap, 3), cell * 3 + gap * 2);
    // Two 3-col castling buttons + one gap = full row.
    assert.equal(
      keypadSpanWidth(cell, gap, 3) * 2 + gap,
      cell * 6 + gap * 5,
    );
  });

  it('keeps a 5-key row plus tall backspace aligned with a normal 6-key row', () => {
    const gap = 4;
    const available = 300;
    const cell = keypadCellWidth(available, gap);
    const fiveKeyRow = cell * 5 + gap * 4 + cell; // 5 singles + gaps + backspace col
    const rowNormal = cell * 6 + gap * 5;
    assert.equal(fiveKeyRow, rowNormal);
    assert.equal(fiveKeyRow, available);
  });
});
