import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { sanToVerbal } from '../../chessParser.ts';
import {
  COUNTDOWN_STEP_MS,
  PlayMoveRecordsStore,
  PlayMoveSession,
  SESSION_SECONDS,
  isCorrectPlayMove,
  isReliablePlayMoveChallenge,
  sideToMoveLabel,
  isFlippedForSideToMove,
  type PlayMoveChallenge,
} from '../index.ts';
import type { TimedChallengeScheduler } from '../../timedChallenge/index.ts';

function sampleChallenge(id: string, setupSan: string): PlayMoveChallenge {
  const game = new Chess();
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
    promptVerbal: sanToVerbal(move.san),
  };
}

const CHALLENGES: PlayMoveChallenge[] = [
  sampleChallenge('p1', 'e4'),
  sampleChallenge('p2', 'Nf3'),
];

function pickTestChallenge(previousId?: string): PlayMoveChallenge | null {
  const available = CHALLENGES.filter((c) => c.puzzleId !== previousId);
  return available[0] ?? CHALLENGES[0] ?? null;
}

class FakeScheduler implements TimedChallengeScheduler {
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

function runCountdownToPlaying(session: PlayMoveSession, scheduler: FakeScheduler) {
  session.startCountdown();
  for (let i = 0; i < 4; i += 1) scheduler.tick(COUNTDOWN_STEP_MS);
  return session.snapshot();
}

describe('play move challenge validity', () => {
  it('marks reliable non-promotion challenges as valid and legal', () => {
    const c = sampleChallenge('ok', 'e4');
    assert.equal(isReliablePlayMoveChallenge(c), true);
    assert.equal(isCorrectPlayMove(c, 'e2', 'e4'), true);
    assert.equal(isCorrectPlayMove(c, 'e2', 'e3'), false);
  });

  it('rejects promotion challenges as unreliable for first implementation', () => {
    const game = new Chess('8/P7/8/8/8/8/8/4K2k w - - 0 1');
    const initial = game.fen();
    const move = game.move({ from: 'a7', to: 'a8', promotion: 'q' });
    assert.ok(move);
    const challenge: PlayMoveChallenge = {
      puzzleId: 'promo',
      initialFen: initial,
      positionFen: game.fen(),
      setupSan: move.san,
      setupMove: { from: move.from, to: move.to, promotion: move.promotion },
      expectedSan: move.san,
      boardPerspective: 'w',
      promptVerbal: sanToVerbal(move.san),
    };
    assert.equal(isReliablePlayMoveChallenge(challenge), false);
  });
});

describe('play move records', () => {
  it('persists best score independently and only when higher', async () => {
    const store = new PlayMoveRecordsStore(new MemoryKeyValueStorage());
    assert.equal(await store.saveScore(3), 3);
    assert.equal(await store.saveScore(1), 3);
    assert.equal(await store.loadBest(), 3);
    await store.reset();
    assert.equal(await store.loadBest(), 0);
  });
});

describe('play move session', () => {
  it('runs countdown then exposes a legal challenge with 60s remaining', () => {
    const scheduler = new FakeScheduler();
    const session = new PlayMoveSession({ scheduler, pickChallenge: pickTestChallenge });
    const snap = runCountdownToPlaying(session, scheduler);
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.remainingSeconds, SESSION_SECONDS);
    assert.ok(snap.challenge);
    if (!snap.challenge) throw new Error('expected challenge');
    const challenge = snap.challenge;
    const game = new Chess(challenge.initialFen);
    const legal = game
      .moves({ verbose: true })
      .some(
        (m) => m.from === challenge.setupMove.from && m.to === challenge.setupMove.to,
      );
    assert.equal(legal, true);
    session.dispose();
  });

  it('increments score on correct board move and advances', () => {
    const scheduler = new FakeScheduler();
    const session = new PlayMoveSession({ scheduler, pickChallenge: pickTestChallenge });
    runCountdownToPlaying(session, scheduler);
    const first = session.snapshot().challenge!;
    session.attemptBoardMove(first.setupMove.from, first.setupMove.to);
    const snap = session.snapshot();
    assert.equal(snap.score.score, 1);
    assert.equal(snap.score.correct, 1);
    assert.notEqual(snap.challenge?.puzzleId, first.puzzleId);
    session.dispose();
  });

  it('keeps the same challenge and bumps boardResetToken after a wrong move', () => {
    const scheduler = new FakeScheduler();
    const session = new PlayMoveSession({ scheduler, pickChallenge: pickTestChallenge });
    runCountdownToPlaying(session, scheduler);
    const first = session.snapshot().challenge!;
    const tokenBefore = session.snapshot().boardResetToken;
    session.attemptBoardMove('a2', 'a3');
    const snap = session.snapshot();
    assert.equal(snap.score.wrong, 1);
    assert.equal(snap.score.score, 0);
    assert.equal(snap.challenge?.puzzleId, first.puzzleId);
    assert.equal(snap.lastFeedback, 'wrong');
    assert.equal(snap.boardResetToken, tokenBefore + 1);
    session.dispose();
  });

  it('ends on global timer and compares records', async () => {
    const scheduler = new FakeScheduler();
    const session = new PlayMoveSession({ scheduler, pickChallenge: pickTestChallenge });
    session.configure({ previousRecord: 0, sessionSeconds: 0.05 });
    runCountdownToPlaying(session, scheduler);
    const c = session.snapshot().challenge!;
    session.attemptBoardMove(c.setupMove.from, c.setupMove.to);
    await new Promise((resolve) => setTimeout(resolve, 80));
    const snap = session.snapshot();
    assert.equal(snap.phase, 'completed');
    assert.equal(snap.isNewRecord, true);
    assert.equal(snap.score.correct, 1);
    session.dispose();
  });

  it('stops timers on dispose so callbacks do not fire after leave', () => {
    const scheduler = new FakeScheduler();
    const session = new PlayMoveSession({ scheduler, pickChallenge: pickTestChallenge });
    session.startCountdown();
    session.dispose();
    scheduler.tick(COUNTDOWN_STEP_MS * 4);
    assert.equal(session.snapshot().phase, 'idle');
  });
});

describe('side to move label and board orientation', () => {
  it('labels White/Black to move and keeps flip in sync', () => {
    assert.equal(sideToMoveLabel('w'), 'Trait aux Blancs');
    assert.equal(sideToMoveLabel('b'), 'Trait aux Noirs');
    assert.equal(isFlippedForSideToMove('w'), false);
    assert.equal(isFlippedForSideToMove('b'), true);
  });

  it('derives label from challenge initialFen turn and matches isFlipped', () => {
    const whiteToMove = sampleChallenge('wtm', 'e4');
    const whiteTurn = new Chess(whiteToMove.initialFen).turn();
    assert.equal(whiteTurn, 'w');
    assert.equal(sideToMoveLabel(whiteTurn), 'Trait aux Blancs');
    assert.equal(isFlippedForSideToMove(whiteTurn), false);

    // After 1.e4, Black to move — build a challenge starting mid-game.
    const mid = new Chess();
    mid.move('e4');
    const blackFen = mid.fen();
    assert.equal(new Chess(blackFen).turn(), 'b');
    const blackTurn = new Chess(blackFen).turn();
    assert.equal(sideToMoveLabel(blackTurn), 'Trait aux Noirs');
    assert.equal(isFlippedForSideToMove(blackTurn), true);
    // Prevent Trait aux Noirs while board is shown from White perspective.
    assert.notEqual(sideToMoveLabel(blackTurn) === 'Trait aux Noirs' && !isFlippedForSideToMove(blackTurn), true);
  });
});
