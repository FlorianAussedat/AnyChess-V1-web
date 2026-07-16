import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { filterBoardPieces } from '../boardDisplay.ts';
import { PuzzleSession } from '../PuzzleSession.ts';
import { emptyPuzzleStats, formatHelpsUsed } from '../types.ts';

type Piece = { type: string; color: 'w' | 'b' };

describe('puzzle board display filter', () => {
  it('hides all pieces without mutating the source board', () => {
    const game = new Chess();
    const board = game.board() as (Piece | null)[][];
    const hidden = filterBoardPieces(board, 'hidden');
    assert.equal(hidden.flat().filter(Boolean).length, 0);
    assert.ok(board.flat().some(Boolean));
  });

  it('reveals only white pieces for blind help', () => {
    const game = new Chess();
    const board = game.board() as (Piece | null)[][];
    const whiteOnly = filterBoardPieces(board, 'white');
    const pieces = whiteOnly.flat().filter(Boolean);
    assert.ok(pieces.length > 0);
    assert.ok(pieces.every((p) => p!.color === 'w'));
  });

  it('reveals only black pieces independently', () => {
    const game = new Chess();
    const board = game.board() as (Piece | null)[][];
    const blackOnly = filterBoardPieces(board, 'black');
    const pieces = blackOnly.flat().filter(Boolean);
    assert.ok(pieces.length > 0);
    assert.ok(pieces.every((p) => p!.color === 'b'));
  });
});

describe('puzzle help tracking', () => {
  it('formats used helps for results', () => {
    const helps = emptyPuzzleStats().helps;
    helps.whiteReveal = true;
    helps.positionRepeat = true;
    assert.match(formatHelpsUsed(helps), /blanches/);
    assert.match(formatHelpsUsed(helps), /répétition/);
    assert.equal(formatHelpsUsed(emptyPuzzleStats().helps), 'aucune');
  });

  it('tracks help flags on session stats without changing puzzle FEN', () => {
    const session = new PuzzleSession();
    const puzzle = {
      id: 'test',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5', 'a7a6', 'b5a4'],
      rating: 1700,
      popularity: 90,
      themes: ['fork'],
    };
    const before = session.load(puzzle);
    const fenAfterLoad = session.getFen();
    const stats = session.getStats();
    stats.helps.whiteReveal = true;
    session.setStats(stats);
    assert.equal(session.getFen(), fenAfterLoad);
    assert.equal(session.getStats().helps.whiteReveal, true);
    assert.equal(before.puzzle.id, 'test');
  });
});

describe('puzzle wrong-legal preview contract', () => {
  it('probes wrong legal moves on a clone without mutating session', () => {
    const session = new PuzzleSession();
    const puzzle = {
      id: 'preview-test',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5', 'a7a6', 'b5a4'],
      rating: 1700,
      popularity: 90,
      themes: ['fork'],
    };
    session.load(puzzle);
    const fenBefore = session.getFen();
    // After setup Bb5, Black to move — a5 is legal but not the solution (a6).
    const outcome = session.attemptMove('a7', 'a5');
    assert.equal(outcome.result, 'wrong-legal');
    assert.equal(session.getFen(), fenBefore);

    const clone = new Chess(fenBefore);
    const preview = clone.move({ from: 'a7', to: 'a5' });
    assert.ok(preview);
    assert.notEqual(clone.fen(), fenBefore);
    assert.equal(session.getFen(), fenBefore);
  });
});
