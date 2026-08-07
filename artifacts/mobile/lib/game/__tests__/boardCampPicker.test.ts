/**
 * Camp zone geometry + Continue notation display + Elo band list.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { campFromSquareTap, CAMP_PICKER_START_FEN } from '../boardCampPicker.ts';
import { beginGameFromCampChoice } from '../campSelectionFlow.ts';
import { campZoneRects } from '../campZoneRects.ts';
import type { BoardPiece } from '../types.ts';
import { continueLineNotationDisplay } from '../../continueLine/continueLineNotationDisplay.ts';
import { groupOpeningSans } from '../../openingQuiz/groupOpeningSans.ts';
import { STOCKFISH_STRENGTH_BANDS } from '../../difficulty/StockfishStrengthBands.ts';

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
    const after = beginGameFromCampChoice('w');
    assert.equal(after.phase, 'playing');
    const board = new Chess().board() as (BoardPiece | null)[][];
    assert.equal(after.phase === 'playing', true);
    assert.notEqual(campFromSquareTap(board, 'e4'), 'w');
  });
});

describe('campZoneRects', () => {
  it('places White band at bottom and Black at top when not flipped', () => {
    const size = 320;
    const zones = campZoneRects(size, false);
    assert.equal(zones.white.height, 80);
    assert.equal(zones.black.height, 80);
    assert.equal(zones.white.top, 240);
    assert.equal(zones.black.top, 0);
    assert.equal(zones.white.width, size);
  });

  it('swaps bands when flipped', () => {
    const size = 320;
    const zones = campZoneRects(size, true);
    assert.equal(zones.white.top, 0);
    assert.equal(zones.black.top, 240);
  });
});

describe('continueLineNotationDisplay', () => {
  const preamble = ['e4', 'e5', 'Nf3', 'Nc6'];

  it('initial state shows start line once, not Position atteinte', () => {
    const d = continueLineNotationDisplay(preamble, [], 0);
    assert.equal(d.kind, 'start');
    assert.equal(d.heading, 'Ligne de départ');
    assert.deepEqual(d.sans, preamble);
  });

  it('after first correct continuation shows Position atteinte with growth', () => {
    const d = continueLineNotationDisplay(preamble, ['Bc4'], 1);
    assert.equal(d.kind, 'reached');
    assert.equal(d.heading, 'Position atteinte');
    assert.deepEqual(d.sans, [...preamble, 'Bc4']);
    assert.equal(d.sans.filter((s) => s === 'e4').length, 1);
  });

  it('empty preamble before first move has no notation card', () => {
    const d = continueLineNotationDisplay([], [], 0);
    assert.equal(d.kind, 'none');
    assert.deepEqual(d.sans, []);
  });
});

describe('numbered SAN formatting for continue/quelle', () => {
  it('pairs even plies', () => {
    assert.deepEqual(groupOpeningSans(['e4', 'e5', 'Nf3', 'Nc6']), [
      { moveNumber: 1, white: 'e4', black: 'e5' },
      { moveNumber: 2, white: 'Nf3', black: 'Nc6' },
    ]);
  });

  it('handles odd ply count without fake black', () => {
    assert.deepEqual(groupOpeningSans(['e4', 'e5', 'Nf3']), [
      { moveNumber: 1, white: 'e4', black: 'e5' },
      { moveNumber: 2, white: 'Nf3' },
    ]);
  });

  it('preserves castling and check SAN tokens', () => {
    assert.deepEqual(groupOpeningSans(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7+']), [
      { moveNumber: 1, white: 'e4', black: 'e5' },
      { moveNumber: 2, white: 'Bc4', black: 'Nc6' },
      { moveNumber: 3, white: 'Qh5', black: 'Nf6' },
      { moveNumber: 4, white: 'Qxf7+' },
    ]);
    assert.deepEqual(groupOpeningSans(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'O-O']), [
      { moveNumber: 1, white: 'e4', black: 'e5' },
      { moveNumber: 2, white: 'Nf3', black: 'Nc6' },
      { moveNumber: 3, white: 'Bb5', black: 'a6' },
      { moveNumber: 4, white: 'O-O' },
    ]);
  });
});

describe('Elo strength bands', () => {
  it('exposes all bands for horizontal scroll (no wrap logic)', () => {
    assert.ok(STOCKFISH_STRENGTH_BANDS.length >= 8);
    assert.ok(STOCKFISH_STRENGTH_BANDS.every((b) => b.id && b.label));
    assert.equal(STOCKFISH_STRENGTH_BANDS[STOCKFISH_STRENGTH_BANDS.length - 1]?.id, 'gt2200');
  });
});
