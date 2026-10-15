import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { chessPhraseGrammar } from '../voskGrammar.ts';

const AMB = '4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1';

describe('chess phrase grammar', () => {
  it('includes every legal destination and unknown, not one expected move', () => {
    const start = new Chess().fen();
    const phrases = chessPhraseGrammar(start, 'fr');
    assert.ok(phrases.includes('[unk]'));
    assert.ok(phrases.includes('e quatre'));
    assert.ok(phrases.includes('d quatre'));
    assert.ok(phrases.includes('cavalier f trois'));
    assert.equal(phrases.some((phrase) => phrase.includes('f3')), false);
  });

  it('adds file disambiguation when two pieces share a square', () => {
    const phrases = chessPhraseGrammar(AMB, 'en');
    assert.ok(phrases.includes('knight e four'));
    assert.ok(phrases.includes('knight c e four'));
    assert.ok(phrases.includes('knight g e four'));
  });

  it('names both castles and both promotion pieces', () => {
    const castle = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const french = chessPhraseGrammar(castle, 'fr');
    assert.ok(french.includes('petit roque'));
    assert.ok(french.includes('grand roque'));
    assert.ok(french.includes('roque'));
    const promo = '3k4/4P3/8/8/8/8/8/4K3 w - - 0 1';
    const english = chessPhraseGrammar(promo, 'en');
    assert.ok(english.includes('e eight queen'));
    assert.ok(english.includes('e eight rook'));
  });
});
