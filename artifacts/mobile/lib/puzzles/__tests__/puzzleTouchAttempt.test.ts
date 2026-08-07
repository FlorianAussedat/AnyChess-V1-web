import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PuzzleSession } from '../PuzzleSession.ts';
import { uciFromSquares, isExpectedMove } from '../PuzzleMoveValidator.ts';

describe('touch vs voice canonical attempt path', () => {
  it('accepts correct non-promotion touch even when UI passes promotion=q', () => {
    const session = new PuzzleSession();
    // After Bb5 setup, Black to play a6.
    session.load({
      id: 'touch-promo-bug',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5', 'a7a6', 'b5a4'],
      rating: 1700,
      popularity: 90,
      themes: ['fork'],
    });

    // Legacy buggy UCI construction would produce a7a6q and fail exact match.
    const buggyUci = uciFromSquares('a7', 'a6', 'q');
    assert.equal(buggyUci, 'a7a6q');
    assert.equal(isExpectedMove('a7a6', buggyUci), false);

    // Session attemptMove must still accept the correct squares
    // (line has one user move left after opponent reply → complete).
    const outcome = session.attemptMove('a7', 'a6', 'q');
    assert.ok(outcome.result === 'correct' || outcome.result === 'complete');
    assert.ok(outcome.userMove);
    assert.equal(outcome.userMove!.from, 'a7');
    assert.equal(outcome.userMove!.to, 'a6');
  });

  it('uses expected UCI promotion when from/to match a promoting solution move', () => {
    const session = new PuzzleSession();
    // White promotes e7e8q after black setup ... (black to move first in source? )
    // Source: black king/pawn; setup black moves; white promotes.
    // Simpler: white to move promotion puzzle — setup is a black move first.
    session.load({
      id: 'promo-line',
      fen: '8/4P3/8/8/8/8/8/4K2k b - - 0 1',
      moves: ['h1h2', 'e7e8q', 'h2h1', 'e8e2'],
      rating: 1800,
      popularity: 90,
      themes: ['promotion'],
    });
    // After Kh2 setup, White plays e8=Q.
    const outcome = session.attemptMove('e7', 'e8', null);
    assert.equal(outcome.result, 'correct');
    assert.equal(outcome.userMove?.promotion, 'q');
  });

  it('voice path via attemptFromChessMove stays consistent with touch', () => {
    const session = new PuzzleSession();
    session.load({
      id: 'voice-touch-parity',
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      moves: ['f1b5', 'a7a6', 'b5a4'],
      rating: 1700,
      popularity: 90,
      themes: ['fork'],
    });
    const game = session.getChess();
    const legal = game.moves({ verbose: true }).find((m) => m.from === 'a7' && m.to === 'a6');
    assert.ok(legal);
    const outcome = session.attemptFromChessMove(legal!);
    assert.ok(outcome.result === 'correct' || outcome.result === 'complete');
  });
});
