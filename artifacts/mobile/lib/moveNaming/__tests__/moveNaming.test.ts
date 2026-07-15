import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseChessVoice } from '../../voice/parseChessVoice.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { emptyMoveNamingScore, scoreMoveNamingAttempt } from '../MoveNamingScorer.ts';
import { MoveNamingRecordsStore } from '../MoveNamingRecords.ts';
import { MoveNamingTimer } from '../MoveNamingTimer.ts';

describe('move naming scoring', () => {
  it('applies correct, wrong, timeout, and recognition scoring', () => {
    let score = emptyMoveNamingScore();
    score = scoreMoveNamingAttempt(score, 'correct');
    score = scoreMoveNamingAttempt(score, 'wrong');
    score = scoreMoveNamingAttempt(score, 'timeout');
    score = scoreMoveNamingAttempt(score, 'recognition-failure');
    assert.deepEqual(score, { score: 0, correct: 1, wrong: 1, timeouts: 1, recognitionFailures: 1 });
  });
});

describe('voice move names', () => {
  it('recognizes castling, captures, pawns in French and English', () => {
    const castle = new Chess();
    ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'].forEach((san) => castle.move(san));
    assert.equal(parseChessVoice('O-O', castle).type, 'move');
    assert.equal(parseChessVoice('petit roque', castle).type, 'move');
    const capture = new Chess();
    ['e4', 'd5'].forEach((san) => capture.move(san));
    assert.equal(parseChessVoice('exd5', capture).type, 'move');
    assert.equal(parseChessVoice('pion prend d5', capture).type, 'move');
    const pawn = new Chess();
    assert.equal(parseChessVoice('e4', pawn).type, 'move');
    assert.equal(parseChessVoice('pion e4', pawn).type, 'move');
  });
});

describe('records and timers', () => {
  it('persists best records and resets them', async () => {
    const records = new MoveNamingRecordsStore(new MemoryKeyValueStorage());
    await records.saveScore(3, 4);
    await records.saveScore(3, 2);
    assert.equal((await records.load())[3], 4);
    await records.reset();
    assert.equal((await records.load())[3], 0);
  });

  it('cleans up challenge callbacks', async () => {
    const timer = new MoveNamingTimer();
    let called = false;
    timer.startChallenge(0.01, () => { called = true; });
    timer.clearChallenge();
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(called, false);
    timer.dispose();
  });
});
