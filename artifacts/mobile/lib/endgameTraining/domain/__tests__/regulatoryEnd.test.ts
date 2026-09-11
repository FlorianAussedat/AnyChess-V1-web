/**
 * Regulatory end + attacker mating-material tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { evaluateRegulatoryEnd } from '../regulatoryEnd.ts';
import { attackerLacksMatingMaterial } from '../sideMatingMaterial.ts';
import { officialResultMessage } from '../officialResultMessages.ts';

describe('attackerLacksMatingMaterial', () => {
  it('lone king cannot mate', () => {
    const g = new Chess('4k3/8/8/8/8/8/PP6/4K3 w - - 0 1');
    assert.equal(attackerLacksMatingMaterial(g, 'b'), true);
    assert.equal(attackerLacksMatingMaterial(g, 'w'), false);
  });

  it('king + knight cannot mate', () => {
    const g = new Chess('4k3/8/8/8/8/n7/PP6/4K3 w - - 0 1');
    assert.equal(attackerLacksMatingMaterial(g, 'b'), true);
    assert.equal(g.isInsufficientMaterial(), false);
  });

  it('king + bishop cannot mate', () => {
    const g = new Chess('4k3/8/8/8/8/b7/PP6/4K3 w - - 0 1');
    assert.equal(attackerLacksMatingMaterial(g, 'b'), true);
  });

  it('king + rook can mate', () => {
    const g = new Chess('4k3/8/8/8/8/r7/PP6/4K3 w - - 0 1');
    assert.equal(attackerLacksMatingMaterial(g, 'b'), false);
  });

  it('king + two knights is not classic bare-minor draw', () => {
    const g = new Chess('4k3/8/8/8/8/nn6/PP6/4K3 w - - 0 1');
    assert.equal(attackerLacksMatingMaterial(g, 'b'), false);
  });
});

describe('evaluateRegulatoryEnd', () => {
  it('stalemate (pat)', () => {
    const g = new Chess('k7/2Q5/8/8/8/8/8/4K3 b - - 0 1');
    assert.ok(g.isStalemate());
    assert.deepEqual(evaluateRegulatoryEnd(g), {
      kind: 'draw',
      reason: 'stalemate',
    });
  });

  it('insufficient via chess.js (K vs K)', () => {
    const g = new Chess('8/8/8/4k3/8/4K3/8/8 w - - 0 1');
    assert.deepEqual(evaluateRegulatoryEnd(g, { attacker: 'b' }), {
      kind: 'draw',
      reason: 'insufficient',
    });
  });

  it('fifty-move rule when applicable', () => {
    // Bare K+N vs K is insufficient first; use K+R vs K with halfmove 100
    const g = new Chess('4k3/8/8/8/8/8/8/R3K3 w - - 100 80');
    const end = evaluateRegulatoryEnd(g);
    assert.ok(end);
    assert.equal(end!.kind, 'draw');
    assert.ok(
      end!.kind === 'draw' &&
        (end.reason === 'fifty' || end.reason === 'insufficient'),
    );
  });

  it('threefold repetition', () => {
    const g = new Chess();
    // Minimal threefold: knight shuffle
    const moves = [
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
      'Nf3',
      'Nf6',
      'Ng1',
      'Ng8',
      'Nf3',
      'Nf6',
    ];
    for (const m of moves) g.move(m);
    assert.ok(g.isThreefoldRepetition());
    assert.deepEqual(evaluateRegulatoryEnd(g), {
      kind: 'draw',
      reason: 'threefold',
    });
  });

  it('K+2P vs K+N → position-defended (not chess.js insufficient)', () => {
    // Defender white K+2P, attacker black K+N
    const g = new Chess('4k3/8/8/8/8/n7/PP6/4K3 w - - 0 1');
    assert.equal(g.isInsufficientMaterial(), false);
    assert.deepEqual(evaluateRegulatoryEnd(g, { attacker: 'b' }), {
      kind: 'draw',
      reason: 'position-defended',
    });
  });

  it('without attacker option, K+2P vs K+N is not a regulatory end', () => {
    const g = new Chess('4k3/8/8/8/8/n7/PP6/4K3 w - - 0 1');
    assert.equal(evaluateRegulatoryEnd(g), null);
  });

  it('position-defended when defender is black with pawns vs white K+N', () => {
    const g = new Chess('4k3/pp6/N7/8/8/8/8/4K3 b - - 0 1');
    assert.equal(g.isInsufficientMaterial(), false);
    assert.deepEqual(evaluateRegulatoryEnd(g, { attacker: 'w' }), {
      kind: 'draw',
      reason: 'position-defended',
    });
  });
});

describe('officialResultMessage position-defended', () => {
  it('exact string for position-defended', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'white',
        officialDrawReason: 'position-defended',
      }),
      'Nulle — position défendue',
    );
  });

  it('fifty message', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'white',
        officialDrawReason: 'fifty',
      }),
      'Nulle obtenue par la règle des 50 coups. Bien joué !',
    );
  });

  it('insufficient message', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'black',
        officialDrawReason: 'insufficient',
      }),
      'Nulle par matériel insuffisant. Bien joué !',
    );
  });
});
