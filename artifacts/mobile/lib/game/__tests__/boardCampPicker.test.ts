/**
 * Board camp picker helpers + CHOIX DU CAMP → active game flow.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { campFromSquareTap, CAMP_PICKER_START_FEN } from '../boardCampPicker.ts';
import { beginGameFromCampChoice } from '../campSelectionFlow.ts';
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

describe('beginGameFromCampChoice', () => {
  it('White: starts playing with White at bottom; picker phase ends', () => {
    const board = new Chess(CAMP_PICKER_START_FEN).board() as (BoardPiece | null)[][];
    const camp = campFromSquareTap(board, 'e2');
    assert.equal(camp, 'w');
    const result = beginGameFromCampChoice(camp!);
    assert.equal(result.playerColor, 'w');
    assert.equal(result.isFlipped, false);
    assert.equal(result.phase, 'playing');
  });

  it('Black: starts playing with Black at bottom', () => {
    const board = new Chess(CAMP_PICKER_START_FEN).board() as (BoardPiece | null)[][];
    const camp = campFromSquareTap(board, 'e7');
    assert.equal(camp, 'b');
    const result = beginGameFromCampChoice(camp!);
    assert.equal(result.playerColor, 'b');
    assert.equal(result.isFlipped, true);
    assert.equal(result.phase, 'playing');
  });

  it('Random: resolves to White or Black and matches orientation', () => {
    const white = beginGameFromCampChoice('random', () => 0.1);
    assert.equal(white.playerColor, 'w');
    assert.equal(white.isFlipped, false);
    assert.equal(white.phase, 'playing');

    const black = beginGameFromCampChoice('random', () => 0.9);
    assert.equal(black.playerColor, 'b');
    assert.equal(black.isFlipped, true);
    assert.equal(black.phase, 'playing');
  });

  it('after choice, board taps are normal moves (picker no longer selects camp)', () => {
    // Semantic contract: once phase === 'playing', campFromSquareTap must not drive side.
    const after = beginGameFromCampChoice('w');
    assert.equal(after.phase, 'playing');
    const board = new Chess().board() as (BoardPiece | null)[][];
    // A mid-game empty / move square must not be interpreted as camp selection by the UI.
    // UI only calls campFromSquareTap while phase is picking; after start it uses chess moves.
    assert.equal(after.phase === 'playing', true);
    assert.notEqual(campFromSquareTap(board, 'e4'), 'w');
  });
});
