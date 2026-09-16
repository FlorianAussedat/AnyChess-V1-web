/**
 * Play-turn state machine — pure transitions for openings / classic.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  flagsFromPlayTurn,
  opponentSearchTurn,
  playTurnAfterEmptyOpponentPick,
  playTurnAfterUndo,
} from '../playTurnState.ts';

describe('flagsFromPlayTurn', () => {
  it('waitingForUser allows action and never thinks', () => {
    const f = flagsFromPlayTurn('waitingForUser');
    assert.equal(f.waitingForUser, true);
    assert.equal(f.isOpponentThinking, false);
    assert.equal(f.canAct, true);
    assert.equal(f.deciding, false);
  });

  it('opponent search blocks the user', () => {
    for (const state of ['playingRepertoireReply', 'waitingForEngine'] as const) {
      const f = flagsFromPlayTurn(state);
      assert.equal(f.waitingForUser, false);
      assert.equal(f.isOpponentThinking, true);
      assert.equal(f.canAct, false);
    }
  });

  it('theory decision is neither waiting nor thinking', () => {
    const f = flagsFromPlayTurn('awaitingTheoryDecision');
    assert.equal(f.deciding, true);
    assert.equal(f.canAct, false);
    assert.equal(f.isOpponentThinking, false);
  });

  it('game over clears all interactive flags', () => {
    const f = flagsFromPlayTurn('waitingForUser', true);
    assert.equal(f.canAct, false);
    assert.equal(f.waitingForUser, false);
  });

  it('error state is idle for retry (not thinking)', () => {
    const f = flagsFromPlayTurn('error');
    assert.equal(f.isOpponentThinking, false);
    assert.equal(f.waitingForUser, false);
    assert.equal(f.canAct, false);
  });
});

describe('opponentSearchTurn', () => {
  it('uses repertoire reply while in book', () => {
    assert.equal(opponentSearchTurn('playingTheory'), 'playingRepertoireReply');
  });

  it('uses engine wait after leaving book', () => {
    assert.equal(opponentSearchTurn('engineContinuation'), 'waitingForEngine');
  });
});

describe('playTurnAfterEmptyOpponentPick', () => {
  it('opens theory decision panels', () => {
    assert.equal(playTurnAfterEmptyOpponentPick('lineComplete'), 'awaitingTheoryDecision');
    assert.equal(playTurnAfterEmptyOpponentPick('outOfTheory'), 'awaitingTheoryDecision');
  });

  it('marks engine failure when continue-vs-engine returns null', () => {
    assert.equal(playTurnAfterEmptyOpponentPick('engineContinuation'), 'error');
  });

  it('falls back to waiting for user in theory', () => {
    assert.equal(playTurnAfterEmptyOpponentPick('playingTheory'), 'waitingForUser');
  });
});

describe('playTurnAfterUndo', () => {
  it('returns waitingForUser when no kickoff needed', () => {
    assert.equal(playTurnAfterUndo(false), 'waitingForUser');
  });

  it('signals engine kickoff when needed', () => {
    assert.equal(playTurnAfterUndo(true), 'waitingForEngine');
  });
});
