import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { getPositionById, listByTheme } from '../../selection/selectors.ts';
import {
  BREAKTHROUGH_REFERENCE_LINES,
  breakMoveAmong,
  legalFirstMoves,
  replayBreakthroughLine,
} from '../breakthroughVerify.ts';

describe('pawn-breakthrough independent check', () => {
  it('keeps the catalog FENs legal with the classical breaks available', () => {
    const first = getPositionById('TE-CANON-PAWN-BREAKTHROUGH');
    assert.ok(first);
    assert.equal(first!.initialFen.split(' ')[0], '7k/ppp5/8/PPP5/8/8/8/4K3');
    const game = new Chess(first!.initialFen);
    assert.equal(game.isGameOver(), false);
    const moves = legalFirstMoves(first!.initialFen);
    assert.equal(breakMoveAmong(moves), 'b6');
    const second = getPositionById('TE-CANON-PAWN-BREAKTHROUGH-2');
    assert.equal(breakMoveAmong(legalFirstMoves(second!.initialFen)), 'bxa5');
    const third = getPositionById('TE-CANON-PAWN-BREAKTHROUGH-3');
    assert.equal(breakMoveAmong(legalFirstMoves(third!.initialFen)), 'exd5');
  });

  it('promotes or mates on every recorded reference line, including both captures after b6', () => {
    assert.ok(BREAKTHROUGH_REFERENCE_LINES.length >= 4);
    const outcomes = BREAKTHROUGH_REFERENCE_LINES.map((line) => replayBreakthroughLine(line.positionId, line.sans));
    for (const row of outcomes) {
      assert.notEqual(row.outcome, 'illegal', row.positionId);
      assert.notEqual(row.outcome, 'draw', `${row.positionId} ${row.line.join(' ')}`);
      assert.ok(row.userPromoted || row.outcome === 'checkmate', JSON.stringify(row));
    }
    const mates = outcomes.filter((row) => row.outcome === 'checkmate');
    const promos = outcomes.filter((row) => row.outcome === 'promotion');
    assert.ok(mates.length >= 3, `mates=${mates.length}`);
    assert.ok(promos.length >= 1, 'the second capture branch at least promotes');
    assert.equal(listByTheme('pawn-breakthrough').length, 3);
  });
});
