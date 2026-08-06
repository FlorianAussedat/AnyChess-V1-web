import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseChessVoice } from '../../voice/parseChessVoice.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { emptyMoveNamingScore, scoreMoveNamingAttempt } from '../MoveNamingScorer.ts';
import { MoveNamingRecordsStore } from '../MoveNamingRecords.ts';
import { TimedChallengeTimer } from '../../timedChallenge/TimedChallengeTimer.ts';
import {
  COUNTDOWN_STEP_MS,
  MoveNamingSession,
  SESSION_SECONDS,
  isMoveNamingRecordBeat,
  type MoveNamingScheduler,
} from '../MoveNamingSession.ts';
import type { MoveNamingChallenge } from '../types.ts';
import {
  boardPerspectiveLabel,
  isFlippedForPerspective,
  pickBoardPerspective,
} from '../boardPerspective.ts';

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
    boardPerspective: 'w',
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
  it('increments score only on correct; wrong/recognition do not change score', () => {
    let score = emptyMoveNamingScore();
    score = scoreMoveNamingAttempt(score, 'correct');
    score = scoreMoveNamingAttempt(score, 'wrong');
    score = scoreMoveNamingAttempt(score, 'timeout');
    score = scoreMoveNamingAttempt(score, 'recognition-failure');
    assert.deepEqual(score, {
      score: 1,
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
  it('persists 60s best and only updates when higher', async () => {
    const records = new MoveNamingRecordsStore(new MemoryKeyValueStorage());
    assert.equal(await records.saveScore(4), 4);
    assert.equal(await records.saveScore(2), 4);
    assert.equal(await records.loadBest(), 4);
    await records.reset();
    assert.equal(await records.loadBest(), 0);
  });

  it('preserves legacy per-second buckets without using them for new saves', async () => {
    const storage = new MemoryKeyValueStorage();
    const records = new MoveNamingRecordsStore(storage);
    await records.saveScoreLegacy(2, 5);
    await records.saveScoreLegacy(4, 7);
    await records.resetCategory(2);
    const loaded = await records.load();
    assert.equal(loaded[2], 0);
    assert.equal(loaded[4], 7);
    // New model key is independent
    assert.equal(await records.loadBest(), 0);
    await records.saveScore(9);
    assert.equal(await records.loadBest(), 9);
    assert.equal((await records.load())[4], 7);
  });

  it('detects a new record beat', () => {
    assert.equal(isMoveNamingRecordBeat(6, 5), true);
    assert.equal(isMoveNamingRecordBeat(5, 5), false);
    assert.equal(isMoveNamingRecordBeat(4, 5), false);
  });

  it('cleans up session callbacks', async () => {
    const timer = new TimedChallengeTimer();
    let called = false;
    timer.startSession(0.01, () => {
      called = true;
    });
    timer.dispose();
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(called, false);
  });
});

describe('move naming session — 60s model', () => {
  it('starts with 60 seconds after countdown', () => {
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

  it('does not auto-advance a challenge while the player thinks', async () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    runCountdownToPlaying(session, scheduler);
    const firstId = session.snapshot().challenge?.puzzleId;
    assert.ok(firstId);
    // Wait longer than any old per-question window (1–10s)
    await new Promise((resolve) => setTimeout(resolve, 1200));
    assert.equal(session.snapshot().challenge?.puzzleId, firstId);
    assert.equal(session.snapshot().score.timeouts, 0);
    assert.equal(session.snapshot().phase, 'playing');
    session.dispose();
  });

  it('increments score on correct and advances to the next challenge', () => {
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

  it('keeps the same challenge after a wrong answer', () => {
    const scheduler = new FakeScheduler();
    const session = testSession(scheduler);
    runCountdownToPlaying(session, scheduler);
    const first = session.snapshot().challenge;
    assert.ok(first);
    const wrongSan = first.expectedSan === 'e4' ? 'd4' : 'e4';
    session.answer(wrongSan);
    const snap = session.snapshot();
    assert.equal(snap.score.wrong, 1);
    assert.equal(snap.score.score, 0);
    assert.equal(snap.challenge?.puzzleId, first.puzzleId);
    assert.equal(snap.lastFeedback, 'wrong');
    session.dispose();
  });

  it('ends the session on global timer and flags a new record', async () => {
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

describe('board perspective (display only)', () => {
  it('maps vision labels and flip flags without changing answer data', () => {
    assert.equal(boardPerspectiveLabel('w'), 'Vision côté Blancs');
    assert.equal(boardPerspectiveLabel('b'), 'Vision côté Noirs');
    assert.equal(isFlippedForPerspective('w'), false);
    assert.equal(isFlippedForPerspective('b'), true);
  });

  it('can generate both white and black perspectives', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      seen.add(pickBoardPerspective(undefined, () => (i % 2 === 0 ? 0.1 : 0.9)));
    }
    assert.ok(seen.has('w'));
    assert.ok(seen.has('b'));
  });

  it('prefers alternating after a previous perspective', () => {
    assert.equal(pickBoardPerspective('w', () => 0.1), 'b');
    assert.equal(pickBoardPerspective('b', () => 0.1), 'w');
  });

  it('does not change FEN / expectedSan when perspective flips', () => {
    const whiteView = sampleChallenge('c1', 'e4');
    const blackView: MoveNamingChallenge = { ...whiteView, boardPerspective: 'b' };
    assert.equal(whiteView.initialFen, blackView.initialFen);
    assert.equal(whiteView.positionFen, blackView.positionFen);
    assert.equal(whiteView.expectedSan, blackView.expectedSan);
    assert.deepEqual(whiteView.setupMove, blackView.setupMove);
    assert.notEqual(whiteView.boardPerspective, blackView.boardPerspective);

    const scheduler = new FakeScheduler();
    const session = new MoveNamingSession({
      scheduler,
      pickChallenge: () => blackView,
    });
    runCountdownToPlaying(session, scheduler);
    const before = session.snapshot().challenge!;
    session.answer(before.expectedSan);
    assert.equal(session.snapshot().score.correct, 1);
    session.dispose();
  });
});
