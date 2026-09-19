/**
 * Display ↔ algebraic mapping (White and Black orientation).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { displayCellToSquare } from '../boardSquares.ts';

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const AFTER_E4_E5 =
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

function dests(fen: string, square: string): string[] {
  return new Chess(fen)
    .moves({ square: square as never, verbose: true })
    .map((m) => m.to);
}

describe('displayCellToSquare', () => {
  it('maps White orientation: top-left a8, White knight g1 at bottom', () => {
    assert.equal(displayCellToSquare(0, 0, false), 'a8');
    assert.equal(displayCellToSquare(7, 0, false), 'a1');
    assert.equal(displayCellToSquare(7, 6, false), 'g1');
    assert.equal(displayCellToSquare(5, 5, false), 'f3');
  });

  it('maps Black orientation: top-left h1, White knight g1 near the top', () => {
    assert.equal(displayCellToSquare(0, 0, true), 'h1');
    assert.equal(displayCellToSquare(0, 1, true), 'g1');
    assert.equal(displayCellToSquare(2, 2, true), 'f3');
    assert.equal(displayCellToSquare(7, 7, true), 'a8');
  });
});

describe('legal knight clicks vs side to move', () => {
  it('White to move: g1→f3 is legal; the same click is a no-op when Black to move', () => {
    assert.ok(dests(START, 'g1').includes('f3'));
    assert.ok(dests(AFTER_E4_E5, 'g1').includes('f3'));
    assert.deepEqual(dests(AFTER_E4, 'g1'), []);
  });

  it('Black to move after e4: g8→f6 is legal', () => {
    assert.ok(dests(AFTER_E4, 'g8').includes('f6'));
    assert.equal(new Chess(AFTER_E4).turn(), 'b');
  });

  it('White to move at start: e2→e4 (pawn to empty square) is legal', () => {
    assert.ok(dests(START, 'e2').includes('e4'));
  });

  it('capture: after 1.e4 d5, exd5 is a legal pawn capture', () => {
    const chess = new Chess(START);
    chess.move('e4');
    chess.move('d5');
    assert.ok(dests(chess.fen(), 'e4').includes('d5'));
  });
});
