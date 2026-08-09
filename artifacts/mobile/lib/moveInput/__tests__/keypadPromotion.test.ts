/**
 * Keypad promotion detection + suffix formatting.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import {
  appendPromotionSuffix,
  fenFromSanHistory,
  keypadBufferNeedsPromotion,
} from '../keypadPromotion.ts';

describe('keypadBufferNeedsPromotion', () => {
  it('detects White pawn to 8th rank without promo piece', () => {
    // White pawn on e7, black king on a8, white king on e1 — e8 promotes.
    const fen = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';
    assert.equal(keypadBufferNeedsPromotion('e8', fen, 'en'), true);
    assert.equal(keypadBufferNeedsPromotion('e8', fen, 'fr'), true);
  });

  it('detects Black pawn to 1st rank', () => {
    const fen = '4k3/8/8/8/8/8/4p3/K7 b - - 0 1';
    assert.equal(keypadBufferNeedsPromotion('e1', fen, 'en'), true);
  });

  it('does not flag when promotion already chosen', () => {
    const fen = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';
    assert.equal(keypadBufferNeedsPromotion('e8=Q', fen, 'en'), false);
    assert.equal(keypadBufferNeedsPromotion('e8=D', fen, 'fr'), false);
    assert.equal(keypadBufferNeedsPromotion('e8=N', fen, 'en'), false);
  });

  it('does not flag piece moves or castling', () => {
    const fen = 'k7/4P3/8/8/8/8/8/4K3 w - - 0 1';
    assert.equal(keypadBufferNeedsPromotion('Ke2', fen, 'en'), false);
    assert.equal(keypadBufferNeedsPromotion('O-O', fen, 'en'), false);
  });

  it('does not flag non-promotion pawn moves', () => {
    const game = new Chess();
    assert.equal(keypadBufferNeedsPromotion('e4', game.fen(), 'en'), false);
  });
});

describe('appendPromotionSuffix', () => {
  it('appends English / French piece letters', () => {
    assert.equal(appendPromotionSuffix('e8', 'q', 'en'), 'e8=Q');
    assert.equal(appendPromotionSuffix('e8', 'n', 'en'), 'e8=N');
    assert.equal(appendPromotionSuffix('e8', 'q', 'fr'), 'e8=D');
    assert.equal(appendPromotionSuffix('e8', 'n', 'fr'), 'e8=C');
    assert.equal(appendPromotionSuffix('exd8', 'r', 'fr'), 'exd8=T');
  });

  it('replaces an existing promotion suffix', () => {
    assert.equal(appendPromotionSuffix('e8=Q', 'n', 'en'), 'e8=N');
  });
});

describe('fenFromSanHistory', () => {
  it('rebuilds FEN from English SANs', () => {
    const fen = fenFromSanHistory(['e4', 'e5']);
    const g = new Chess(fen);
    assert.equal(g.turn(), 'w');
    assert.ok(g.history().length === 0); // fresh position at that fen
    assert.match(fen, /^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/8\/PPPP1PPP\/RNBQKBNR w /);
  });
});
