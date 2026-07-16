import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseChessVoice } from '../../voice/parseChessVoice.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { emptyMoveNamingScore, scoreMoveNamingAttempt } from '../MoveNamingScorer.ts';
import { MoveNamingRecordsStore } from '../MoveNamingRecords.ts';
import { MoveNamingTimer } from '../MoveNamingTimer.ts';
import {
  COUNTDOWN_STEP_MS,
  MoveNamingSession,
  SESSION_SECONDS,
  isMoveNamingRecordBeat,
  type MoveNamingScheduler,
} from '../MoveNamingSession.ts';
import type { MoveNamingChallenge } from '../types.ts';

function sampleChallenge(id: string, setupSan: string, initialFen?: string): MoveNamingChallenge {
  const game = new Chess(initialFen);
  const initial = game.fen();
  const move = game.move(setupSan);
  if (!move) throw new Error(`Invalid setup SAN: ${setupSan}`);
  return {
    puzzleId: id,
    initialFen: initial,
    positionFen: game.fen(),
    setupSan: move.san,
    setupMove: { from: move.from, to: move.to, promotion: move.promotion },
    expectedSan: move.san,
  };
}

const CHALLENGES: MoveNamingChallenge[] = [
  sampleChallenge('c1', 'e4'),
  sampleChallenge('c2', 'd4'),
];

function pickTestChallenge(previousId?: string): MoveNamingChallenge | null {
  const available = CHALLENGES.filter((c) => c.puzzleId !== previousId);
  return available[0] ?? CHALLENGES[0] ?? null;
}

class FakeScheduler implements MoveNamingScheduler {
  private tasks: { id: number; due: number; fn: () => void }[] = [];
  private nextId = 1;
  private time = 0;

  setTimeout(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const id = this.nextId++;
    this.tasks.push({ id, due: this.time + ms, fn });
    return id as ReturnType<typeof setTimeout>;
  }

  clearTimeout(handle: ReturnType<typeof setTimeout> | null): void {
    if (handle === null) return;
    const hid = handle as number;
    this.tasks = this.tasks.filter((task) => task.id !== hid);
  }

  tick(ms: number): void {
    this.time += ms;
    const due = this.tasks
      .filter((task) => task.due <= this.time)
      .sort((a, b) => a.due - b.due);
    this.tasks = this.tasks.filter((task) => task.due > this.time);
    for (const task of due) task.fn();
  }
}

function runCountdownToPlaying(
  session: MoveNamingSession,
  scheduler: FakeScheduler,
): ReturnType<MoveNamingSession['snapshot']> {
  session.startCountdown();
  for (let i = 0; i < 4; i += 1) scheduler.tick(COUNTDOWN_STEP_MS);
  return session.snapshot();
}

function testSession(scheduler: FakeScheduler): MoveNamingSession {
  return new MoveNamingSession({ scheduler, pickChallenge: pickTestChallenge });
}

describe('move naming scoring', () => {
  it('applies correct, wrong, timeout, and recognition scoring', () => {
    let score = emptyMoveNamingScore();
    score = scoreMoveNamingAttempt(score, 'correct');
    score = scoreMoveNamingAttempt(score, 'wrong');
    score = scoreMoveNamingAttempt(score, 'timeout');
    score = scoreMoveNamingAttempt(score, 'recognition-failure');
    assert.deepEqual(score, {
      score: 0,
      correct: 1,
      wrong: 1,
      timeouts: 1,
      recognitionFailures: 1,
    });
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

  it('resets one timing category', async () => {
    const records = new MoveNamingRecordsStore(new MemoryKeyValueStorage());
    await records.saveScore(2, 5);
    await records.saveScore(4, 7);
    await records.resetCategory(2);
    const loaded = await records.load();
    assert.equal(loaded[2], 0);
    assert.equal(loaded[4], 7);
  });

  it('detects a new record beat', () => {
    assert.equal(isMoveNamingRecordBeat(6, 5), true);
    assert.equal(isMoveNamingRecordBeat(5, 5), false);
    assert.equal(isMoveNamingRecordBeat(4, 5), false);
  });

  it('cleans up challenge callbacks', async () => {
    const timer = new MoveNamingTimer();
    let called = false;
    timer.startChallenge(0.01, () => {
      called = true;
    });
    timer.clearChallenge();
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(called, false);
    timer.dispose();
  });
});

describe('move naming session', () => {
  it('runs countdown then starts the session at GO', () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    session.startCountdown();
    assert.equal(session.snapshot().phase, 'countdown');
    assert.equal(session.snapshot().countdownLabel, '3');
    scheduler.tick(COUNTDOWN_STEP_MS);
    assert.equal(session.snapshot().countdownLabel, '2');
    scheduler.tick(COUNTDOWN_STEP_MS);
    assert.equal(session.snapshot().countdownLabel, '1');
    scheduler.tick(COUNTDOWN_STEP_MS);
    assert.equal(session.snapshot().countdownLabel, 'GO');
    scheduler.tick(COUNTDOWN_STEP_MS);
    const snap = session.snapshot();
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.remainingSeconds, SESSION_SECONDS);
    assert.ok(snap.challenge);
    session.dispose();
  });

  it('times out challenge 1 with the selected duration', async () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    session.configure({ responseSeconds: 1 });
    runCountdownToPlaying(session, scheduler);
    assert.equal(session.snapshot().score.timeouts, 0);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    assert.equal(session.snapshot().score.timeouts, 1);
    session.dispose();
  });

  it('scores answers and advances to the next challenge', () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    runCountdownToPlaying(session, scheduler);
    const first = session.snapshot().challenge;
    assert.ok(first);
    session.answer(first.expectedSan);
    const snap = session.snapshot();
    assert.equal(snap.score.correct, 1);
    assert.equal(snap.score.score, 1);
    assert.notEqual(snap.challenge?.puzzleId, first.puzzleId);
    session.dispose();
  });

  it('ends the session and flags a new record on completion', async () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    session.configure({ previousRecord: 1, sessionSeconds: 0.05 });
    runCountdownToPlaying(session, scheduler);
    session.answer(session.snapshot().challenge!.expectedSan);
    session.answer(session.snapshot().challenge!.expectedSan);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const snap = session.snapshot();
    assert.equal(snap.phase, 'completed');
    assert.equal(snap.isNewRecord, true);
    assert.equal(snap.score.correct, 2);
    session.dispose();
  });

  it('does not flag a new record when score does not beat previous', async () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    session.configure({ previousRecord: 5, sessionSeconds: 0.05 });
    runCountdownToPlaying(session, scheduler);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const snap = session.snapshot();
    assert.equal(snap.phase, 'completed');
    assert.equal(snap.isNewRecord, false);
    session.dispose();
  });

  it('cleans up countdown timers on dispose', () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    session.startCountdown();
    session.dispose();
    scheduler.tick(COUNTDOWN_STEP_MS * 4);
    assert.equal(session.snapshot().phase, 'idle');
  });
});
