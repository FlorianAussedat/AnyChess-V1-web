/**
 * Post-game grade without a real engine: recording, resume, and session isolation.
 * The engine file covers the same path with Stockfish.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../../storage/KeyValueStorage.ts';
import {
  configureTheoreticalStoreStorage,
  clearTheoreticalStoreCache,
  recordAttempt,
  getAttempt,
  getThemeAttempts,
  getThemeComprehension,
} from '../../persistence/TheoreticalEndgameStore.ts';
import { replayUserDecisions } from '../decisionPath.ts';
import { runPostGameGrade } from '../postGameGrade.ts';
import { claimEngineForPlay, releaseEngineFromPlay, resetGradeGate } from '../gradeGate.ts';
import type { DefenseAnalysis } from '../../../defendDraw/defenseTypes.ts';
import type { TheoreticalAttemptResult } from '../../domain/types.ts';

const MATE = '7k/6Q1/6K1/8/8/8/8/8 w - - 0 1';

function analysis(mateIn: number | null): DefenseAnalysis {
  return {
    scoreCp: 0,
    mateIn,
    depth: 12,
    wdl: { win: 900, draw: 50, loss: 50 },
    bestMove: { from: 'g7', to: 'h7' },
  };
}

function win(overrides: Partial<TheoreticalAttemptResult> = {}): TheoreticalAttemptResult {
  return {
    outcome: 'success',
    positionId: 'TE-CANON-QUEEN-MATE',
    themeId: 'queen-mate',
    objective: 'WIN',
    objectiveKind: 'mate',
    playerColor: 'white',
    userMoves: 1,
    scoreScale: 'quality-5',
    attemptScore: null,
    quality: null,
    durationMs: 1000,
    firstTheoreticalLoss: null,
    startFen: MATE,
    endFen: MATE,
    moveSans: ['Qh7'],
    finishedAt: '2026-10-12T12:00:00.000Z',
    offScore: false,
    analysisStatus: 'pending',
    gradeConfidence: null,
    variantGroup: 'TE-CANON-QUEEN-MATE',
    ...overrides,
  };
}

describe('post-game grade flow', { concurrency: 1 }, () => {
  beforeEach(() => {
    configureTheoreticalStoreStorage(new MemoryKeyValueStorage());
    clearTheoreticalStoreCache();
    resetGradeGate();
  });

  it('replays only the user decisions', () => {
    const game = new Chess('8/8/8/4k3/8/8/8/4K2Q w - - 0 1');
    const first = game.moves({ verbose: true })[0]!;
    game.move(first);
    const reply = game.moves({ verbose: true })[0]!;
    game.move(reply);
    const points = replayUserDecisions('8/8/8/4k3/8/8/8/4K2Q w - - 0 1', 'white', [
      first.san,
      reply.san,
    ]);
    assert.equal(points.length, 1);
    assert.equal(points[0]!.san, first.san);
  });

  it('grades a win whose in-play distances were missing', async () => {
    const delta = await recordAttempt(win());
    assert.equal(delta.attemptCount, 1);
    assert.equal(delta.winCount, 1);
    assert.equal(delta.count, 0);
    assert.equal(delta.attemptScore, null);
    const graded = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt: win().finishedAt,
      analyzer: { analyze: async () => analysis(1) },
      movetimeMs: 50,
      deadlineMs: 2000,
    });
    assert.equal(graded?.attemptScore, 5);
    assert.equal(graded?.analysisStatus, 'estimated');
    assert.equal(graded?.gradeConfidence, 'estimated');
    const summary = await getThemeComprehension('queen-mate');
    assert.equal(summary.count, 0);
    assert.equal(summary.estimatedCount, 1);
    assert.equal(summary.attemptCount, 1);
    assert.equal((await getThemeAttempts('queen-mate')).length, 1);
  });

  it('keeps the win and no invented score when the deadline is already spent', async () => {
    await recordAttempt(win({ finishedAt: '2026-10-12T12:01:00.000Z' }));
    const graded = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt: '2026-10-12T12:01:00.000Z',
      analyzer: { analyze: async () => analysis(1) },
      deadlineMs: 0,
      now: () => 10_000,
    });
    assert.equal(graded?.attemptScore, null);
    assert.equal(graded?.analysisStatus, 'failed');
    assert.equal(graded?.gradeCause, 'deadline');
    const stored = await getAttempt('queen-mate', 'TE-CANON-QUEEN-MATE', '2026-10-12T12:01:00.000Z');
    assert.equal(stored?.outcome, 'success');
    assert.equal(stored?.attemptScore, null);
  });

  it('resumes after a close without measuring the finished decision again', async () => {
    const start = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
    const game = new Chess(start);
    const user = game.moves({ verbose: true })[0]!;
    game.move(user);
    const reply = game.moves({ verbose: true })[0]!;
    game.move(reply);
    const second = game.moves({ verbose: true })[0]!;
    const sans = [user.san, reply.san, second.san];
    const finishedAt = '2026-10-12T12:02:00.000Z';
    await recordAttempt(
      win({
        startFen: start,
        moveSans: sans,
        userMoves: 2,
        finishedAt,
      }),
    );
    let calls = 0;
    const closing = {
      analyze: async (fen: string) => {
        calls += 1;
        if (calls === 3) {
          claimEngineForPlay();
          return analysis(null);
        }
        return analysis(fen.includes(' w ') ? 4 : -3);
      },
    };
    const paused = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt,
      analyzer: closing,
      movetimeMs: 20,
      deadlineMs: 5000,
    });
    assert.equal(paused?.attemptScore, null);
    assert.equal(paused?.analysisStatus, 'pending');
    assert.equal(paused?.gradeCursor, 1);
    releaseEngineFromPlay(1);
    const seen: string[] = [];
    const resumed = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt,
      analyzer: {
        analyze: async (fen: string) => {
          seen.push(fen);
          return analysis(fen.includes(' w ') ? 3 : -2);
        },
      },
      movetimeMs: 20,
      deadlineMs: 5000,
    });
    assert.equal(typeof resumed?.attemptScore, 'number');
    assert.equal(resumed?.analysisStatus, 'estimated');
    assert.equal(seen.length, 2);
    assert.equal((await getThemeAttempts('queen-mate')).length, 1);
  });

  it('does not store another endgame’s score on the attempt that was interrupted', async () => {
    const start = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
    const game = new Chess(start);
    const user = game.moves({ verbose: true })[0]!;
    game.move(user);
    const reply = game.moves({ verbose: true })[0]!;
    game.move(reply);
    const second = game.moves({ verbose: true })[0]!;
    const firstAt = '2026-10-12T12:03:00.000Z';
    const secondAt = '2026-10-12T12:04:00.000Z';
    await recordAttempt(win({ startFen: start, moveSans: [user.san, reply.san, second.san], userMoves: 2, finishedAt: firstAt }));
    await recordAttempt(win({ finishedAt: secondAt, moveSans: ['Qh7'], startFen: MATE, userMoves: 1 }));
    let calls = 0;
    const first = runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt: firstAt,
      analyzer: {
        analyze: async (fen: string) => {
          calls += 1;
          if (calls === 3) claimEngineForPlay();
          return analysis(fen.includes(' w ') ? 4 : -3);
        },
      },
      movetimeMs: 20,
      deadlineMs: 5000,
    });
    const paused = await first;
    assert.equal(paused?.attemptScore, null);
    releaseEngineFromPlay(1);
    const other = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-CANON-QUEEN-MATE',
      finishedAt: secondAt,
      analyzer: { analyze: async () => analysis(1) },
      movetimeMs: 20,
      deadlineMs: 5000,
    });
    assert.equal(other?.attemptScore, 5);
    const kept = await getAttempt('queen-mate', 'TE-CANON-QUEEN-MATE', firstAt);
    assert.equal(kept?.attemptScore, null);
    assert.notEqual(kept?.attemptScore, other?.attemptScore);
    assert.equal((await getThemeAttempts('queen-mate')).length, 2);
  });
});
