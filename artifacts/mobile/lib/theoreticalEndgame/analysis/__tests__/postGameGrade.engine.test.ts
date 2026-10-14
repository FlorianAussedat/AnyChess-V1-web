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
import { getPositionById, listByTheme } from '../../selection/selectors.ts';
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
import {
  POST_GAME_ATTEMPT_BUDGET_MS,
  POST_GAME_BUDGET_STEPS_MS,
  POST_GAME_LONG_BUDGET_STEPS_MS,
  adaptiveDeadlineMs,
  runPostGameGrade,
} from '../postGameGrade.ts';
import { gradeFamilyFor } from '../../domain/gradeFamily.ts';
import { summarizeCoverage, SCORED_SUCCESS_TARGET, type CoverageRow } from '../coverageReport.ts';
import { claimEngineForPlay, releaseEngineFromPlay, resetGradeGate } from '../gradeGate.ts';
import { playCapFor, playTowardObjective, replayRecordedLine } from '../playTowardObjective.ts';
import { QUALITY_TRAJECTORIES, RECORDED_START_FEN } from '../qualityTrajectories.ts';
import {
  BREAKTHROUGH_REFERENCE_LINES,
  replayBreakthroughLine,
  searchBreakthroughs,
} from '../breakthroughVerify.ts';
import { referenceGrade } from '../referenceGrade.ts';

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

function recordedCatalogPosition(
  trajectory: (typeof QUALITY_TRAJECTORIES)[number],
): TheoreticalEndgamePosition {
  const fen = RECORDED_START_FEN[trajectory.positionId];
  if (fen) {
    const base = listByTheme(trajectory.themeId)[0]!;
    return {
      ...base,
      id: trajectory.positionId,
      initialFen: fen,
      playerColor: 'white',
      objective: 'WIN',
      objectiveKind: 'mate',
    };
  }
  const catalog = getPositionById(trajectory.positionId);
  if (!catalog) throw new Error(trajectory.positionId);
  return catalog;
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
    assert.equal(summary.count, 1);
    assert.equal(summary.score, graded?.attemptScore);
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

  it('reports several scored successes per theme, including two bishops and draws', { timeout: 480_000 }, async () => {
    const rows: CoverageRow[] = [];
    let stamp = 0;
    const nextStamp = () => {
      stamp += 1;
      return new Date(Date.UTC(2026, 9, 13, 8, 0, stamp)).toISOString();
    };

    const gradePlayed = async (
      position: TheoreticalEndgamePosition,
      played: {
        outcome: 'success' | 'theoretical-loss' | 'interrupted';
        sans: string[];
        userMoves: number;
        endFen: string;
        cause: string;
      },
      kind: CoverageRow['kind'],
      quality: CoverageRow['quality'],
      playMs: number,
    ): Promise<void> => {
      const finishedAt = nextStamp();
      const capInterrupted = played.outcome === 'interrupted' && played.cause === 'cap';
      let analysisStatus: CoverageRow['analysisStatus'] = 'not-started';
      let gradeCause: CoverageRow['gradeCause'] = played.cause;
      let attemptScore: number | null = null;
      let gradeMs = 0;
      if (played.outcome === 'success' || played.outcome === 'theoretical-loss') {
        await recordAttempt({
          outcome: played.outcome,
          positionId: position.id,
          themeId: position.themeId,
          objective: position.objective,
          objectiveKind: position.objectiveKind,
          playerColor: position.playerColor,
          userMoves: played.userMoves,
          scoreScale: 'quality-5',
          attemptScore: played.outcome === 'theoretical-loss' ? 0 : null,
          quality: null,
          durationMs: playMs,
          firstTheoreticalLoss: null,
          startFen: position.initialFen,
          endFen: played.endFen,
          moveSans: played.sans,
          finishedAt,
          offScore: false,
          analysisStatus: played.outcome === 'theoretical-loss' ? 'not-needed' : 'pending',
          gradeConfidence: played.outcome === 'theoretical-loss' ? 'exact' : null,
          variantGroup: position.variantGroup ?? position.id,
        });
        if (played.outcome === 'theoretical-loss') {
          analysisStatus = 'not-needed';
          attemptScore = 0;
          gradeCause = null;
        } else {
          const t0 = Date.now();
          const graded = await runPostGameGrade({
            themeId: position.themeId,
            positionId: position.id,
            finishedAt,
            analyzer,
            budgetStepsMs:
              position.themeId === 'two-bishops-mate' && played.userMoves >= 12
                ? [400]
                : played.userMoves >= 10
                  ? [...POST_GAME_LONG_BUDGET_STEPS_MS]
                  : [...POST_GAME_BUDGET_STEPS_MS],
            deadlineMs:
              position.themeId === 'two-bishops-mate' && played.userMoves >= 12
                ? 5_000
                : Math.min(
                    POST_GAME_ATTEMPT_BUDGET_MS,
                    played.userMoves >= 10
                      ? POST_GAME_ATTEMPT_BUDGET_MS
                      : adaptiveDeadlineMs(Math.max(1, played.userMoves)),
                  ),
          });
          gradeMs = Date.now() - t0;
          analysisStatus = graded?.analysisStatus ?? 'failed';
          gradeCause = graded?.gradeCause ?? null;
          attemptScore = graded?.attemptScore ?? null;
        }
      }
      rows.push({
        themeId: position.themeId,
        positionId: position.id,
        kind,
        quality,
        launched: true,
        objective: position.objective,
        outcome: played.outcome === 'interrupted' ? 'interrupted' : played.outcome,
        capInterrupted,
        scoredSuccess: played.outcome === 'success' && typeof attemptScore === 'number',
        attemptScore,
        analysisStatus,
        gradeCause,
        playMs,
        gradeMs,
        userMoves: played.userMoves,
      });
    };

    for (const trajectory of QUALITY_TRAJECTORIES) {
      const position = recordedCatalogPosition(trajectory);
      const t0 = Date.now();
      const played = replayRecordedLine(position, [...trajectory.sans]);
      await gradePlayed(position, played, 'recorded', trajectory.quality, Date.now() - t0);
    }

    const catalogBishops = listByTheme('two-bishops-mate').find(
      (row) => row.id === 'TE-CANON-TWO-BISHOPS-MATE-2',
    );
    assert.ok(catalogBishops);
    assert.ok(playCapFor(catalogBishops!) >= 36);
    {
      const t0 = Date.now();
      const played = await playTowardObjective(catalogBishops!, playAnalyzer, {
        movetimeMs: 300,
        maxUserMoves: playCapFor(catalogBishops!),
      });
      await gradePlayed(catalogBishops!, played, 'autoplay', 'efficient', Date.now() - t0);
    }

    const catalogLine = QUALITY_TRAJECTORIES.find((row) => row.id === 'two-bishops-catalog-1');
    assert.ok(catalogLine);
    const catalogPosition = recordedCatalogPosition(catalogLine!);
    const abortPlayed = replayRecordedLine(catalogPosition, [...catalogLine!.sans]);
    const abortAt = nextStamp();
    await recordAttempt({
      outcome: 'success',
      positionId: `${catalogPosition.id}-abort`,
      themeId: catalogPosition.themeId,
      objective: catalogPosition.objective,
      objectiveKind: catalogPosition.objectiveKind,
      playerColor: catalogPosition.playerColor,
      userMoves: abortPlayed.userMoves,
      scoreScale: 'quality-5',
      attemptScore: null,
      quality: null,
      durationMs: 1,
      firstTheoreticalLoss: null,
      startFen: catalogPosition.initialFen,
      endFen: abortPlayed.endFen,
      moveSans: abortPlayed.sans,
      finishedAt: abortAt,
      offScore: false,
      analysisStatus: 'pending',
      gradeConfidence: null,
      variantGroup: catalogPosition.id,
    });
    const abortStarted = Date.now();
    const aborted = await runPostGameGrade({
      themeId: catalogPosition.themeId,
      positionId: `${catalogPosition.id}-abort`,
      finishedAt: abortAt,
      analyzer,
      budgetStepsMs: [400],
      deadlineMs: 90_000,
      mateDriveFallback: false,
    });
    const abortMs = Date.now() - abortStarted;

    const recordedThemes = new Set(QUALITY_TRAJECTORIES.map((row) => row.themeId));
    for (const themeId of THEME_IDS) {
      if (themeId === 'two-bishops-mate' || recordedThemes.has(themeId)) continue;
      const position = listByTheme(themeId).find((row) => row.objective === 'WIN') ?? listByTheme(themeId)[0];
      assert.ok(position, themeId);
      const t0 = Date.now();
      const played = await playTowardObjective(position!, playAnalyzer, {
        movetimeMs: 250,
        maxUserMoves: playCapFor(position!),
      });
      const playMs = Date.now() - t0;
      if (played.outcome === 'success') {
        await gradePlayed(position!, played, 'autoplay', 'efficient', playMs);
      } else {
        rows.push({
          themeId: position!.themeId,
          positionId: position!.id,
          kind: 'autoplay',
          quality: 'efficient',
          launched: true,
          objective: position!.objective,
          outcome: played.outcome,
          capInterrupted: played.outcome === 'interrupted' && played.cause === 'cap',
          scoredSuccess: false,
          attemptScore: played.outcome === 'theoretical-loss' ? 0 : null,
          analysisStatus: played.outcome === 'theoretical-loss' ? 'not-needed' : played.outcome === 'success' ? 'pending' : 'not-started',
          gradeCause: played.cause,
          playMs,
          gradeMs: 0,
          userMoves: played.userMoves,
        });
      }
    }

    const breakthroughLines = BREAKTHROUGH_REFERENCE_LINES.map((line) =>
      replayBreakthroughLine(line.positionId, line.sans),
    );
    const breakthroughSearches = await searchBreakthroughs(playAnalyzer, 200);

    const report = summarizeCoverage(rows);
    const bishops = report.byTheme.find((row) => row.themeId === 'two-bishops-mate');
    const draws = ['philidor', 'vancura', 'bad-bishop', 'lateral-checks', 'pawn-square', 'rook-pawn'] as const;
    const queenEfficient = rows.find((row) => row.positionId === 'TE-ENGINE-QUEEN' && row.quality === 'efficient');
    const queenDetour = rows.find((row) => row.positionId === 'TE-ENGINE-QUEEN' && row.quality === 'detour');
    const philidorEfficient = rows.find((row) => row.themeId === 'philidor' && row.quality === 'efficient' && row.scoredSuccess);
    const philidorDetour = rows.find((row) => row.themeId === 'philidor' && row.quality === 'detour' && row.scoredSuccess);

    console.log(
      `SCORE_COVERAGE ${JSON.stringify({
        launched: report.launched,
        finishedWon: report.finishedWon,
        finishedLost: report.finishedLost,
        capInterrupted: report.capInterrupted,
        scoredSuccesses: report.scoredSuccesses,
        scoredWins: report.scoredWins,
        scoredDefenses: report.scoredDefenses,
        winSuccesses: report.winSuccesses,
        defenseSuccesses: report.defenseSuccesses,
        belowTarget: report.belowTarget,
        target: SCORED_SUCCESS_TARGET,
        playMs: report.playMs,
        gradeMs: report.gradeMs,
        byTheme: report.byTheme,
        twoBishops: bishops,
        queenEfficient: queenEfficient?.attemptScore ?? null,
        queenDetour: queenDetour?.attemptScore ?? null,
        breakthrough: {
          lines: breakthroughLines.map((row) => ({
            id: row.positionId,
            outcome: row.outcome,
            promoted: row.userPromoted,
          })),
          searches: breakthroughSearches,
        },
        budgetCompare: {
          abortMs,
          abortStatus: aborted?.analysisStatus ?? null,
          abortCause: aborted?.gradeCause ?? null,
          abortScore: aborted?.attemptScore ?? null,
          attemptBudgetMs: POST_GAME_ATTEMPT_BUDGET_MS,
          progressiveCatalog: rows
            .filter((row) => row.positionId.startsWith('TE-CANON-TWO-BISHOPS-MATE') && row.kind === 'recorded')
            .map((row) => ({
              id: row.positionId,
              score: row.attemptScore,
              status: row.analysisStatus,
              cause: row.gradeCause,
              gradeMs: row.gradeMs,
              userMoves: row.userMoves,
            })),
        },
      })}`,
    );

    assert.equal(report.byTheme.length, THEME_IDS.length);
    assert.ok(report.launched > 18);
    assert.ok(report.finishedWon >= 12, `finishedWon=${report.finishedWon}`);
    assert.ok(report.scoredDefenses >= 10, `scoredDefenses=${report.scoredDefenses} wins=${report.scoredWins}`);
    assert.ok(report.scoredWins >= 10, `scoredWins=${report.scoredWins}`);
    assert.notEqual(report.scoredDefenses, 0);
    for (const theme of report.byTheme) {
      if (theme.finishedWon <= 0) continue;
      assert.ok(
        theme.scoredRate >= SCORED_SUCCESS_TARGET,
        `${theme.themeId} scored ${theme.scoredSuccesses}/${theme.finishedWon} family=${theme.family} ${JSON.stringify(theme.causes)}`,
      );
    }
    assert.equal(report.belowTarget.length, 0, `belowTarget=${report.belowTarget.join(',')}`);
    for (const trajectory of QUALITY_TRAJECTORIES) {
      const position = recordedCatalogPosition(trajectory);
      const family = gradeFamilyFor(position.themeId, position.objective);
      if (family !== 'pawn-win' && family !== 'defense') continue;
      const row = rows.find(
        (entry) =>
          entry.kind === 'recorded' &&
          entry.positionId === position.id &&
          entry.quality === trajectory.quality,
      );
      const independent = referenceGrade(position, [...trajectory.sans]);
      assert.equal(independent.played.outcome, 'success', trajectory.id);
      assert.equal(typeof independent.score, 'number', trajectory.id);
      assert.equal(row?.scoredSuccess, true, `${trajectory.id} ${JSON.stringify(row)}`);
      assert.equal(row?.attemptScore, independent.score, `${trajectory.id} engine=${row?.attemptScore} ref=${independent.score}`);
    }
    assert.ok(breakthroughLines.every((row) => row.outcome === 'checkmate' || row.outcome === 'promotion'));
    assert.ok(breakthroughLines.some((row) => row.outcome === 'checkmate'));
    assert.equal(breakthroughSearches.length, 3);
    assert.ok((bishops?.finishedWon ?? 0) >= 2, `two bishops wins=${bishops?.finishedWon}`);
    assert.ok((bishops?.scoredSuccesses ?? 0) >= 2, `two bishops scored=${JSON.stringify(bishops)}`);
    const bishopsEfficient = rows.find(
      (row) => row.positionId === 'TE-ENGINE-BISHOPS' && row.quality === 'efficient',
    );
    const bishopsDetour = rows.find(
      (row) => row.positionId === 'TE-ENGINE-BISHOPS' && row.quality === 'detour',
    );
    assert.equal(bishopsEfficient?.attemptScore, 5);
    assert.equal(bishopsDetour?.outcome, 'success');
    if (bishopsDetour?.scoredSuccess) {
      assert.ok((bishopsDetour.attemptScore ?? 5) < 5, `two bishops detour=${bishopsDetour.attemptScore}`);
    }
    for (const themeId of draws) {
      const theme = report.byTheme.find((row) => row.themeId === themeId);
      assert.ok((theme?.scoredSuccesses ?? 0) >= 2, `${themeId} scored=${theme?.scoredSuccesses}`);
    }
    assert.equal(queenEfficient?.scoredSuccess, true);
    assert.equal(queenEfficient?.attemptScore, 5);
    assert.ok((queenDetour?.attemptScore ?? 5) < 5, `queen detour=${queenDetour?.attemptScore}`);
    assert.ok(
      (philidorEfficient?.attemptScore ?? 0) > (philidorDetour?.attemptScore ?? 0),
      `philidor efficient=${philidorEfficient?.attemptScore} detour=${philidorDetour?.attemptScore}`,
    );
    assert.equal(aborted?.attemptScore ?? null, null, 'a 400 ms pass cannot grade a DTM-33 two-bishops line');
    const progressiveCatalog = rows.filter(
      (row) => row.positionId.startsWith('TE-CANON-TWO-BISHOPS-MATE') && row.kind === 'recorded',
    );
    assert.ok(progressiveCatalog.length >= 2);
    assert.equal(abortPlayed.outcome, 'success');
    const catalogThree = progressiveCatalog.find((row) => row.positionId === 'TE-CANON-TWO-BISHOPS-MATE-3');
    assert.ok(catalogThree, 'catalog DTM-27 line must be launched');
    assert.equal(catalogThree?.outcome, 'success');
    const lucena = report.byTheme.find((row) => row.themeId === 'lucena');
    const queenVsPawn = report.byTheme.find((row) => row.themeId === 'queen-vs-pawn');
    const rookCatalog = rows.find(
      (row) => row.positionId === 'TE-CANON-ROOK-MATE-2' && row.quality === 'efficient',
    );
    const rookCatalogDetour = rows.find(
      (row) => row.positionId === 'TE-CANON-ROOK-MATE-2' && row.quality === 'detour',
    );
    assert.ok((lucena?.scoredSuccesses ?? 0) >= 1, `lucena scored=${JSON.stringify(lucena)}`);
    assert.ok((queenVsPawn?.finishedWon ?? 0) >= 2, `queen-vs-pawn=${JSON.stringify(queenVsPawn)}`);
    assert.ok(catalogThree?.scoredSuccess, `catalog DTM-27=${JSON.stringify(catalogThree)}`);
    assert.ok(rookCatalog?.scoredSuccess, `rook catalog=${JSON.stringify(rookCatalog)}`);
    if (rookCatalog?.scoredSuccess && rookCatalogDetour?.scoredSuccess) {
      assert.ok(
        (rookCatalog.attemptScore ?? 0) > (rookCatalogDetour.attemptScore ?? 5),
        `rook catalog efficient=${rookCatalog.attemptScore} detour=${rookCatalogDetour.attemptScore}`,
      );
    }
  });
});
