import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseChessVoice } from '../../voice/parseChessVoice.ts';
import { agreeHypotheses, type VoskAlternative } from '../voskDecision.ts';

function interpret(fen: string, language: 'fr' | 'en') {
  return (text: string) => {
    const result = parseChessVoice(text, new Chess(fen), {
      mode: 'classic',
      chessNotation: language,
    });
    if (result.type === 'move') return `move:${result.move.san.replace(/[+#]/g, '')}`;
    if (result.type === 'ambiguous') return 'ambiguous';
    if (result.type === 'command') return `command:${result.command}`;
    return 'nomove';
  };
}

function decide(fen: string, language: 'fr' | 'en', alts: VoskAlternative[]) {
  return agreeHypotheses(alts, interpret(fen, language));
}

const START = new Chess().fen();
const NF3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const CASTLE = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
const AMB = '4k3/8/8/8/8/2N3N1/8/4K3 w - - 0 1';

describe('Vosk hypothesis agreement', () => {
  it('keeps knight f3 when a shorter alternative drops the piece name', () => {
    const decision = decide(NF3, 'en', [
      { text: 'knight f three', score: 108.72 },
      { text: 'f three', score: 107.96 },
    ]);
    assert.deepEqual(decision, { status: 'accept', text: 'knight f three' });
  });

  it('does not play when e4 and d4 are both close', () => {
    const decision = decide(START, 'en', [
      { text: 'd four', score: 76.581 },
      { text: 'e four', score: 74.926 },
    ]);
    assert.equal(decision.status, 'reject');
  });

  it('does not choose a castle when roque and grand roque are both close', () => {
    const decision = decide(CASTLE, 'fr', [
      { text: 'roque', score: 63.72 },
      { text: 'grand roque', score: 63.328 },
    ]);
    assert.equal(decision.status, 'reject');
  });

  it('accepts a clear french knight move', () => {
    const decision = decide(NF3, 'fr', [
      { text: 'cavalier f trois', score: 85.91 },
      { text: 'cavalier en f trois', score: 82.6 },
    ]);
    assert.deepEqual(decision, { status: 'accept', text: 'cavalier f trois' });
  });

  it('passes a single ambiguous transcript through for the chess parser', () => {
    const decision = decide(AMB, 'fr', [{ text: 'cavalier e quatre', score: 97.8 }]);
    assert.deepEqual(decision, { status: 'accept', text: 'cavalier e quatre' });
  });

  it('does not pick one knight when a precise alternative is also close', () => {
    const decision = decide(AMB, 'fr', [
      { text: 'cavalier e quatre', score: 97.871 },
      { text: 'cavalier c e quatre', score: 96.5 },
    ]);
    assert.equal(decision.status, 'reject');
  });

  it('does not promote a chess fragment ranked under unknown', () => {
    const decision = decide(START, 'fr', [
      { text: '', score: 98.408 },
      { text: 'pion g', score: 97.154 },
    ]);
    assert.equal(decision.status, 'reject');
  });

  it('rejects silence and unrelated speech', () => {
    assert.equal(decide(START, 'fr', []).status, 'reject');
    assert.equal(decide(START, 'en', [{ text: '[unk]', score: 10 }]).status, 'reject');
    assert.equal(decide(START, 'fr', [{ text: 'bonjour', score: 20 }]).status, 'reject');
  });
});
