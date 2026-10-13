/**
 * Full grading path with the bundled Stockfish 18 lite process.
 * A simulated analyser is not used for the score.
 */
import assert from 'node:assert/strict';
import { describe, it, before, after, beforeEach } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { ChessEngineService } from '../../../engines/analysis/ChessEngineService.ts';
import type { DefenseAnalysis, DefenseAnalyzer } from '../../../defendDraw/defenseTypes.ts';
import { MemoryKeyValueStorage } from '../../../storage/KeyValueStorage.ts';
import { THEME_IDS } from '../../domain/themes.ts';
import { listByTheme } from '../../selection/selectors.ts';
import type { TheoreticalAttemptResult, TheoreticalEndgamePosition } from '../../domain/types.ts';
import {
  clearTheoreticalStoreCache,
  configureTheoreticalStoreStorage,
  getAttempt,
  getThemeAttempts,
  getThemeComprehension,
  recordAttempt,
} from '../../persistence/TheoreticalEndgameStore.ts';
import { createWasmStockfishTransport } from '../wasmStockfishTransport.ts';
import { runPostGameGrade } from '../postGameGrade.ts';
import { claimEngineForPlay, releaseEngineFromPlay, resetGradeGate } from '../gradeGate.ts';

/** Legal mate in one: the queen does not already check. */
const MATE = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';
const MATE_AFTER = '7k/5KQ1/8/8/8/8/8/8 b - - 1 1';
const QUEEN_CATALOG = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
const enginePath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../public/engine/stockfish-18-lite-single.js',
);

let engine: ChessEngineService;
let playAnalyzer: DefenseAnalyzer;
let analyzer: DefenseAnalyzer;

function toDefense(result: Awaited<ReturnType<ChessEngineService['analyze']>>): DefenseAnalysis {
  return {
    scoreCp: result.scoreCp,
    mateIn: result.mateIn,
    depth: result.depth,
    wdl: result.wdl,
    bestMove: result.bestMove,
  };
}

function win(overrides: Partial<TheoreticalAttemptResult> = {}): TheoreticalAttemptResult {
  return {
    outcome: 'success',
    positionId: 'TE-ENGINE-QUEEN',
    themeId: 'queen-mate',
    objective: 'WIN',
    objectiveKind: 'mate',
    playerColor: 'white',
    userMoves: 1,
    scoreScale: 'quality-5',
    attemptScore: null,
    quality: null,
    durationMs: 400,
    firstTheoreticalLoss: null,
    startFen: MATE,
    endFen: MATE_AFTER,
    moveSans: ['Qg7#'],
    finishedAt: '2026-10-12T18:00:00.000Z',
    offScore: false,
    analysisStatus: 'pending',
    gradeConfidence: null,
    variantGroup: 'queen-mate',
    ...overrides,
  };
}

async function playAuto(position: TheoreticalEndgamePosition, movetimeMs: number, maxUserMoves: number) {
  const game = new Chess(position.initialFen);
  const user = position.playerColor === 'white' ? 'w' : 'b';
  const sans: string[] = [];
  let userMoves = 0;
  let cause: string | null = null;
  while (!game.isGameOver() && userMoves < maxUserMoves) {
    const result = await playAnalyzer.analyze(game.fen(), movetimeMs);
    const best = result.bestMove;
    if (!best) {
      cause = 'engine-no-move';
      break;
    }
    const side = game.turn();
    let played: { san: string } | null = null;
    try {
      played = game.move({
        from: best.from,
        to: best.to,
        ...(best.promotion ? { promotion: best.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
      });
    } catch {
      played = null;
    }
    if (!played) {
      cause = 'engine-illegal-move';
      break;
    }
    sans.push(played.san);
    if (side === user) userMoves += 1;
  }
  let outcome: 'success' | 'theoretical-loss' | 'unfinished' = 'unfinished';
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    outcome = winner === user ? 'success' : 'theoretical-loss';
  } else if (game.isDraw()) {
    outcome = position.objective === 'DRAW' ? 'success' : 'theoretical-loss';
  } else if (!cause) {
    cause = 'game-not-finished';
  }
  return { outcome, sans, userMoves, endFen: game.fen(), cause };
}

async function playFragment(
  startFen: string,
  playerColor: 'white' | 'black',
  userMovesWanted: number,
  movetimeMs: number,
): Promise<{ sans: string[]; userMoves: number; endFen: string }> {
  const game = new Chess(startFen);
  const user = playerColor === 'white' ? 'w' : 'b';
  const sans: string[] = [];
  let userMoves = 0;
  while (!game.isGameOver() && userMoves < userMovesWanted) {
    const result = await playAnalyzer.analyze(game.fen(), movetimeMs);
    if (!result.bestMove) break;
    const side = game.turn();
    const played = game.move({
      from: result.bestMove.from,
      to: result.bestMove.to,
      ...(result.bestMove.promotion
        ? { promotion: result.bestMove.promotion as 'q' | 'r' | 'b' | 'n' }
        : {}),
    });
    if (!played) break;
    sans.push(played.san);
    if (side === user) userMoves += 1;
  }
  return { sans, userMoves, endFen: game.fen() };
}

describe('theoretical score with Stockfish', { concurrency: 1 }, () => {
  before(async () => {
    configureTheoreticalStoreStorage(new MemoryKeyValueStorage());
    clearTheoreticalStoreCache();
    resetGradeGate();
    engine = new ChessEngineService({
      createTransport: createWasmStockfishTransport,
      enginePath,
      moveTimeMs: 400,
      analysisTimeoutMs: 8000,
      bootTimeoutMs: 15000,
    });
    await engine.init();
    playAnalyzer = {
      analyze: async (fen, movetimeMs) =>
        toDefense(
          await engine.analyzePosition({
            fen,
            movetimeMs: movetimeMs ?? 200,
            depth: 12,
          }),
        ),
    };
    // Grading must not cap depth: mate often appears after depth 14.
    analyzer = {
      analyze: async (fen, movetimeMs) =>
        toDefense(await engine.analyze(fen, movetimeMs ?? 600)),
    };
  });

  beforeEach(() => {
    resetGradeGate();
  });

  after(() => {
    engine?.destroy();
  });

  it('records a win before the score exists, then grades it with the engine', async () => {
    const finishedAt = '2026-10-12T18:00:00.000Z';
    const delta = await recordAttempt(win({ finishedAt }));
    assert.equal(delta.attemptScore, null);
    assert.equal(delta.count, 0);
    assert.equal(delta.attemptCount, 1);
    assert.equal(delta.winCount, 1);
    const average = await getThemeComprehension('queen-mate');
    assert.equal(average.count, 0);
    assert.equal(average.estimatedCount, 0);

    const graded = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-ENGINE-QUEEN',
      finishedAt,
      analyzer,
      movetimeMs: 400,
      deadlineMs: 8000,
    });
    assert.equal(
      graded?.gradeCause ?? null,
      null,
      `grade failed: ${graded?.analysisStatus} ${graded?.gradeCause}`,
    );
    assert.equal(typeof graded?.attemptScore, 'number');
    assert.ok((graded?.attemptScore ?? 0) >= 1);
    assert.equal(graded?.analysisStatus, 'estimated');
    assert.equal(graded?.gradeConfidence, 'estimated');
    await recordAttempt(win({ finishedAt }));
    const stored = await getThemeAttempts('queen-mate');
    assert.equal(stored.length, 1);
    const summary = await getThemeComprehension('queen-mate');
    assert.equal(summary.attemptCount, 1);
    assert.equal(summary.winCount, 1);
    assert.equal(summary.count, 0);
    assert.equal(summary.estimatedCount, 1);
  });

  it('keeps a partial engine grade and finishes it after a close', async () => {
    const fragment = await playFragment(QUEEN_CATALOG, 'white', 2, 300);
    assert.ok(fragment.userMoves >= 2, 'engine must play two user moves');
    const finishedAt = '2026-10-12T18:05:00.000Z';
    await recordAttempt(
      win({
        positionId: 'TE-ENGINE-RESUME',
        startFen: QUEEN_CATALOG,
        endFen: fragment.endFen,
        moveSans: fragment.sans,
        userMoves: fragment.userMoves,
        finishedAt,
      }),
    );
    let playToken = 0;
    const paused = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-ENGINE-RESUME',
      finishedAt,
      analyzer,
      movetimeMs: 800,
      deadlineMs: 10000,
      onProgress: (record) => {
        if ((record.gradeCursor ?? 0) >= 1 && playToken === 0) {
          playToken = claimEngineForPlay(() => engine.stop());
        }
      },
    });
    assert.equal(paused?.attemptScore, null, `pause: ${paused?.analysisStatus} ${paused?.gradeCause}`);
    assert.equal(paused?.analysisStatus, 'pending');
    assert.ok((paused?.gradeCursor ?? 0) >= 1);
    assert.ok(paused?.measuredDecisions?.[0]?.fenBefore);
    const cursor = paused?.gradeCursor ?? 0;
    const already = paused?.measuredDecisions?.[0]?.fenBefore ?? '';
    releaseEngineFromPlay(playToken);
    const seen: string[] = [];
    const resumed = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-ENGINE-RESUME',
      finishedAt,
      analyzer: {
        analyze: async (fen, ms) => {
          seen.push(fen);
          return analyzer.analyze(fen, ms ?? 400);
        },
      },
      movetimeMs: 800,
      deadlineMs: 10000,
    });
    assert.equal(
      resumed?.gradeCause ?? null,
      null,
      `resume failed: ${resumed?.analysisStatus} ${resumed?.gradeCause}`,
    );
    assert.equal(typeof resumed?.attemptScore, 'number');
    assert.equal(resumed?.analysisStatus, 'estimated');
    assert.equal(seen.includes(already), false);
    assert.ok((resumed?.gradeCursor ?? 0) > cursor);
    assert.equal((await getThemeAttempts('queen-mate')).filter((row) => row.positionId === 'TE-ENGINE-RESUME').length, 1);
  });

  it('starts another endgame during analysis without mixing the two scores', async () => {
    const fragment = await playFragment(QUEEN_CATALOG, 'white', 2, 300);
    assert.ok(fragment.userMoves >= 2);
    const firstAt = '2026-10-12T18:10:00.000Z';
    const secondAt = '2026-10-12T18:11:00.000Z';
    await recordAttempt(
      win({
        positionId: 'TE-ENGINE-FIRST',
        startFen: QUEEN_CATALOG,
        moveSans: fragment.sans,
        userMoves: fragment.userMoves,
        endFen: fragment.endFen,
        finishedAt: firstAt,
      }),
    );
    await recordAttempt(win({ positionId: 'TE-ENGINE-SECOND', finishedAt: secondAt }));
    let playToken = 0;
    const paused = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-ENGINE-FIRST',
      finishedAt: firstAt,
      analyzer,
      movetimeMs: 800,
      deadlineMs: 10000,
      onProgress: (record) => {
        if ((record.gradeCursor ?? 0) >= 1 && playToken === 0) {
          playToken = claimEngineForPlay(() => engine.stop());
        }
      },
    });
    assert.equal(paused?.attemptScore, null);
    releaseEngineFromPlay(playToken);
    const other = await runPostGameGrade({
      themeId: 'queen-mate',
      positionId: 'TE-ENGINE-SECOND',
      finishedAt: secondAt,
      analyzer,
      movetimeMs: 400,
      deadlineMs: 8000,
    });
    assert.equal(
      other?.gradeCause ?? null,
      null,
      `second job failed: ${other?.analysisStatus} ${other?.gradeCause}`,
    );
    assert.equal(typeof other?.attemptScore, 'number');
    const first = await getAttempt('queen-mate', 'TE-ENGINE-FIRST', firstAt);
    assert.equal(first?.attemptScore, null);
    assert.notEqual(first?.finishedAt, other?.finishedAt);
  });

    it('reports scored attempts across the 18 themes, including the two bishops', { timeout: 240_000 }, async () => {
    const rows: Array<Record<string, string | number | null>> = [];
    let finished = 0;
    let scored = 0;
    for (const themeId of THEME_IDS) {
      const position = listByTheme(themeId)[0];
      assert.ok(position, themeId);
      const played = await playAuto(position!, themeId === 'two-bishops-mate' ? 400 : 250, themeId === 'two-bishops-mate' ? 20 : 12);
      let analysisStatus: string = 'not-finished';
      let gradeCause = played.cause;
      let attemptScore: number | null = null;
      if (played.outcome === 'success' || played.outcome === 'theoretical-loss') {
        finished += 1;
        const finishedAt = `2026-10-12T19:${String(rows.length).padStart(2, '0')}:00.000Z`;
        await recordAttempt({
          outcome: played.outcome,
          positionId: position!.id,
          themeId,
          objective: position!.objective,
          objectiveKind: position!.objectiveKind,
          playerColor: position!.playerColor,
          userMoves: played.userMoves,
          scoreScale: 'quality-5',
          attemptScore: played.outcome === 'theoretical-loss' ? 0 : null,
          quality: null,
          durationMs: 1,
          firstTheoreticalLoss: null,
          startFen: position!.initialFen,
          endFen: played.endFen,
          moveSans: played.sans,
          finishedAt,
          offScore: false,
          analysisStatus: played.outcome === 'theoretical-loss' ? 'not-needed' : 'pending',
          gradeConfidence: played.outcome === 'theoretical-loss' ? 'exact' : null,
          variantGroup: position!.variantGroup ?? position!.id,
        });
        if (played.outcome === 'theoretical-loss') {
          analysisStatus = 'not-needed';
          attemptScore = 0;
          gradeCause = null;
          scored += 1;
        } else {
          const graded = await runPostGameGrade({
            themeId,
            positionId: position!.id,
            finishedAt,
            analyzer,
            movetimeMs: themeId === 'two-bishops-mate' ? 800 : 600,
            deadlineMs: themeId === 'two-bishops-mate' ? 16000 : 10000,
          });
          analysisStatus = graded?.analysisStatus ?? 'failed';
          gradeCause = graded?.gradeCause ?? null;
          attemptScore = graded?.attemptScore ?? null;
          if (typeof attemptScore === 'number') scored += 1;
        }
      }
      rows.push({
        themeId,
        positionId: position!.id,
        outcome: played.outcome,
        userMoves: played.userMoves,
        analysisStatus,
        attemptScore,
        cause: gradeCause,
      });
    }
    const bishops = rows.find((row) => row.themeId === 'two-bishops-mate');
    assert.ok(bishops);
    assert.equal(rows.length, 18);
    const proportion = finished === 0 ? 0 : scored / finished;
    const report = {
      themes: rows.length,
      finished,
      scored,
      proportion,
      unscoredCauses: rows
        .filter((row) => row.outcome !== 'unfinished' && typeof row.attemptScore !== 'number')
        .map((row) => ({ themeId: row.themeId, cause: row.cause, status: row.analysisStatus })),
      unfinished: rows.filter((row) => row.outcome === 'unfinished').map((row) => ({
        themeId: row.themeId,
        cause: row.cause,
        userMoves: row.userMoves,
      })),
      twoBishops: bishops,
    };
    console.log(`SCORE_COVERAGE ${JSON.stringify(report)}`);
    assert.equal(report.themes, 18);
    assert.ok(report.twoBishops);
  });
});
