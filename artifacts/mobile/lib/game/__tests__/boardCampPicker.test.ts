/**
 * Board camp picker helpers.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { campFromSquareTap, CAMP_PICKER_START_FEN } from '../boardCampPicker.ts';
import type { BoardPiece } from '../types.ts';

describe('boardCampPicker', () => {
  it('maps white piece taps to white and black piece taps to black', () => {
    const board = new Chess(CAMP_PICKER_START_FEN).board() as (BoardPiece | null)[][];
    assert.equal(campFromSquareTap(board, 'e2'), 'w');
    assert.equal(campFromSquareTap(board, 'a1'), 'w');
    assert.equal(campFromSquareTap(board, 'e7'), 'b');
    assert.equal(campFromSquareTap(board, 'e8'), 'b');
  });

  it('ignores empty squares', () => {
    const board = new Chess(CAMP_PICKER_START_FEN).board() as (BoardPiece | null)[][];
    assert.equal(campFromSquareTap(board, 'e4'), null);
    assert.equal(campFromSquareTap(board, 'd5'), null);
  });
});
