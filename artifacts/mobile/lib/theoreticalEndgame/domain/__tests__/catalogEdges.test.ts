/**
 * Catalog edges: pawn square, promotions, injected illegal positions, defence ends.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { THEORETICAL_ENDGAME_POOL } from '../../data/pool.generated.ts';
import { validateFenLegality, validateThemeMaterial } from '../fenLegality.ts';
import { assessDefense } from '../defenseFinish.ts';
import { meetsObjective } from '../theoreticalResult.ts';

describe('injected invalid positions', () => {
  it('rejects an illegal check, adjacent kings, and a terminal start', () => {
    const illegal = validateFenLegality('8/8/8/8/8/5k2/8/6KQ w - - 0 1');
    assert.equal(illegal.ok, false);
    const adjacent = validateFenLegality('8/8/8/3k4/4K3/8/8/8 w - - 0 1');
    assert.equal(adjacent.ok, false);
    const mate = validateFenLegality('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
    assert.equal(mate.ok, false);
    const wrong = validateThemeMaterial('queen-mate', '8/8/8/4k3/8/8/8/4K2R w - - 0 1');
    assert.equal(wrong.ok, false);
  });
});

describe('pawn square edges', () => {
  const square = THEORETICAL_ENDGAME_POOL.filter((p) => p.themeId === 'pawn-square');

  it('defender positions are not an immediate capture', () => {
    for (const p of square.filter((x) => x.objective === 'DRAW')) {
      const captures = new Chess(p.initialFen).moves({ verbose: true }).filter((m) => m.captured);
      assert.equal(captures.length, 0, p.id);
      assert.equal(p.objectiveKind, 'stop-pawn');
    }
  });

  it('attacker positions are not a pawn already on the 7th', () => {
    for (const p of square.filter((x) => x.objective === 'WIN')) {
      const game = new Chess(p.initialFen);
      const board = game.board();
      for (const row of board) {
        for (const piece of row) {
          if (!piece || piece.type !== 'p') continue;
        }
      }
      const placement = p.initialFen.split(' ')[0]!;
      const ranks = placement.split('/');
      assert.equal(/[P]/.test(ranks[1] ?? ''), false, p.id);
      assert.equal(p.objectiveKind, 'promote-and-win');
      assert.equal(p.proof.confidence, 'exact');
    }
  });
});

describe('promotion that does not win', () => {
  it('a queen dropped beside the enemy king can be taken at once', () => {
    const game = new Chess('8/8/8/8/8/k7/7p/6K1 b - - 0 1');
    const promo = game.moves({ verbose: true }).find((m) => m.promotion === 'q');
    assert.ok(promo);
    game.move(promo!);
    const take = game.moves({ verbose: true }).find((m) => m.captured === 'q');
    assert.ok(take, 'the new queen is capturable');
    const inCatalog = THEORETICAL_ENDGAME_POOL.some((p) => p.initialFen.startsWith('8/8/8/8/8/k7/7p/6K1'));
    assert.equal(inCatalog, false);
  });
});

describe('defence finish', () => {
  it('pawn-square defence completes when the king steps into the square', () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-PAWN-SQUARE-D1')!;
    const game = new Chess(pos.initialFen);
    const toward = game.moves({ verbose: true }).find((m) => m.to === 'g7');
    assert.ok(toward);
    const assessed = assessDefense({
      themeId: 'pawn-square',
      initialFen: pos.initialFen,
      sans: [toward!.san],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(assessed.complete, true);
  });

  it('does not finish Philidor when the rook leaves the barrier', () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-PHILIDOR')!;
    const game = new Chess(pos.initialFen);
    const leave = game.moves({ verbose: true }).find((m) => m.piece === 'r' && m.to[1] !== '6');
    assert.ok(leave);
    const quiet = assessDefense({
      themeId: 'philidor',
      initialFen: pos.initialFen,
      sans: [leave!.san],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(quiet.applicable, true);
    assert.equal(quiet.complete, false);
  });

  it('Vancura completes on the pawn rank and not by stepping off it', () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-VANCURA-1')!;
    const held = assessDefense({
      themeId: 'vancura',
      initialFen: pos.initialFen,
      sans: ['Rc5'],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(held.complete, true);
    const off = assessDefense({
      themeId: 'vancura',
      initialFen: pos.initialFen,
      sans: ['Rc8'],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(off.complete, false);
  });

  it('bad bishop completes only in the saving corner', () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-BAD-BISHOP-3')!;
    const held = assessDefense({
      themeId: 'bad-bishop',
      initialFen: pos.initialFen,
      sans: ['Kh8'],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(held.complete, true);
    const missed = assessDefense({
      themeId: 'bad-bishop',
      initialFen: THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-BAD-BISHOP-1')!.initialFen,
      sans: ['Ke7'],
      playerColor: 'black',
      objective: 'DRAW',
    });
    assert.equal(missed.complete, false);
  });
});

describe('draw objective', () => {
  it('a defender win still meets a draw objective', () => {
    assert.equal(meetsObjective('DRAW', 'WIN'), true);
    assert.equal(meetsObjective('DRAW', 'DRAW'), true);
    assert.equal(meetsObjective('WIN', 'DRAW'), false);
  });
});
