/**
 * Défends la nulle — WDL probe + 10-move session.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DefendDrawSession,
  DEFEND_DRAW_TARGET_MOVES,
  heuristicWdl,
  pickDefendDrawPosition,
  positionsForDifficulty,
  probeWdl,
  verdictFromCp,
} from '../index.ts';

describe('wdl helpers', () => {
  it('maps centipawns into win/draw/loss buckets', () => {
    assert.equal(verdictFromCp(200), 'win');
    assert.equal(verdictFromCp(-200), 'loss');
    assert.equal(verdictFromCp(10), 'draw');
  });

  it('detects insufficient material as a draw', async () => {
    const r = await probeWdl('8/8/8/4k3/8/8/8/4K3 w - - 0 1', {
      disableTablebase: true,
    });
    assert.equal(r.verdict, 'draw');
    assert.ok(r.source === 'terminal' || r.source === 'heuristic');
  });

  it('heuristic keeps low-material quiet endings as draws', () => {
    const r = heuristicWdl('8/8/8/4k3/8/8/8/4KB2 w - - 0 1');
    assert.equal(r.verdict, 'draw');
  });
});

describe('defend draw positions', () => {
  it('exposes positions for every difficulty', () => {
    for (const d of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
      assert.ok(positionsForDifficulty(d).length >= 1, d);
      const pick = pickDefendDrawPosition(d, [], () => 0);
      assert.equal(pick.difficulty, d);
    }
  });
});

describe('DefendDrawSession', () => {
  it('targets 10 player moves and starts on a drawn position', async () => {
    const session = new DefendDrawSession({
      probeOptions: { disableTablebase: true },
    });
    const snap = await session.start('debutant', [], () => 0);
    assert.equal(snap.targetMoves, DEFEND_DRAW_TARGET_MOVES);
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.lastProbe?.verdict, 'draw');
    assert.ok(snap.position);
  });

  it('counts a legal king move and keeps the draw on K vs K', async () => {
    const session = new DefendDrawSession({
      probeOptions: { disableTablebase: true },
      targetMoves: 2,
    });
    await session.start('debutant', [], () => 0); // k-vs-k
    const after = await session.attemptMove('e1', 'e2');
    assert.equal(after.playerMovesMade, 1);
    assert.ok(after.phase === 'playing' || after.phase === 'thinking' || after.phase === 'won' || after.phase === 'drawn-early');
    // After opponent reply we should still be defending a draw (or already finished).
    if (after.phase === 'playing') {
      assert.notEqual(after.lastProbe?.verdict, 'loss');
    }
  });

  it('wins after holding the configured number of moves', async () => {
    const session = new DefendDrawSession({
      probeOptions: { disableTablebase: true },
      targetMoves: 1,
    });
    await session.start('debutant', [], () => 0);
    const after = await session.attemptMove('e1', 'd1');
    assert.equal(after.playerMovesMade, 1);
    assert.equal(after.phase, 'won');
  });
});
