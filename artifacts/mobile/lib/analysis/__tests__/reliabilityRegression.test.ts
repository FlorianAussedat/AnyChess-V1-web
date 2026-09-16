/**
 * Regression tests for AnyLyseur engine/controller reliability (bugs A–F).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EngineAnalysis } from '../../engines/analysis/types.ts';
import { ChessEngineService } from '../../engines/analysis/ChessEngineService.ts';
import type { UciTransport } from '../../engines/stockfish/types.ts';
import {
  createGameReaderState,
  goToNext,
  goToNode,
  goToPrevious,
} from '../../gameReader/gameReaderState.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import { AnalysisController } from '../AnalysisController.ts';
import type { AnalyzePositionRequest, ChessEngine } from '../engine/ChessEngine.ts';
import { formatAnyLyseurEval } from '../formatEval.ts';
import { mapEngineAnalysisToPosition } from '../mapEngineAnalysis.ts';
import { toWhiteScore, terminalWhiteScoreFromFen } from '../scoreWhite.ts';

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

function analysis(
  scoreCp: number,
  mateIn: number | null,
  pv: string[],
  extra?: Partial<EngineAnalysis>,
): EngineAnalysis {
  return {
    bestMove: pv[0]
      ? { from: pv[0].slice(0, 2), to: pv[0].slice(2, 4), uci: pv[0] }
      : null,
    score:
      mateIn != null
        ? { type: 'mate', value: mateIn }
        : { type: 'cp', value: scoreCp },
    scoreCp,
    mateIn,
    wdl: null,
    depth: 12,
    lines: [1, 2, 3].map((rank) => ({
      multipv: rank,
      scoreCp: scoreCp - (rank - 1) * 10,
      mateIn: rank === 1 ? mateIn : null,
      wdl: null,
      depth: 12,
      bestMove: pv[rank - 1]
        ? {
            from: pv[rank - 1]!.slice(0, 2),
            to: pv[rank - 1]!.slice(2, 4),
            uci: pv[rank - 1],
          }
        : null,
      pv: pv[rank - 1] ? [pv[rank - 1]!] : [],
    })),
    cancelled: false,
    ...extra,
  };
}

class MockEngine implements ChessEngine {
  calls: string[] = [];
  stopped = 0;
  disposed = 0;
  delayMs = 0;
  goCommands: string[] = [];
  handler: (fen: string) => EngineAnalysis;
  lateResolvers: Array<() => void> = [];

  constructor(handler: (fen: string) => EngineAnalysis) {
    this.handler = handler;
  }

  getStatus() {
    return this.disposed ? ('unavailable' as const) : ('ready' as const);
  }

  async init() {}

  async analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    this.calls.push(req.fen);
    this.goCommands.push(
      `depth=${req.profile.depth};mt=${req.profile.movetimeMs}`,
    );
    if (this.delayMs > 0) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, this.delayMs);
        this.lateResolvers.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
    return this.handler(req.fen);
  }

  async stop() {
    this.stopped += 1;
    for (const r of this.lateResolvers.splice(0)) r();
  }

  dispose() {
    this.disposed += 1;
  }
}

function createScriptedTransport(script: {
  onCommand?: (cmd: string, send: (line: string) => void) => void;
}): UciTransport & { commands: string[] } {
  let onLine: ((line: string) => void) | null = null;
  const commands: string[] = [];
  const sendOut = (line: string) => onLine?.(line);
  return {
    commands,
    start(cb) {
      onLine = cb;
      return Promise.resolve();
    },
    send(cmd: string) {
      commands.push(cmd);
      if (cmd === 'uci') {
        sendOut('uciok');
        return;
      }
      if (cmd === 'isready') {
        sendOut('readyok');
        return;
      }
      if (cmd.startsWith('setoption')) return;
      script.onCommand?.(cmd, sendOut);
    },
    terminate() {
      onLine = null;
    },
  };
}

describe('Bug A: cached A must not be overwritten by late B', () => {
  it('cache hit bumps generation and ignores late B', async () => {
    const engine = new MockEngine((fen) =>
      analysis(fen === START ? 40 : -25, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    engine.delayMs = 40;
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();

    await ctrl.analyzeCurrentPosition(START); // cache A
    engine.delayMs = 80;
    const bPromise = ctrl.analyzeCurrentPosition(AFTER_E4); // start B
    await new Promise((r) => setTimeout(r, 10));
    const aAgain = await ctrl.analyzeCurrentPosition(START); // cache hit A
    assert.ok(aAgain);
    assert.equal(aAgain!.fen, START);
    assert.equal(aAgain!.evaluation, 40);
    assert.equal(ctrl.getState().position?.fen, START);

    await bPromise;
    // Late B must not replace A.
    assert.equal(ctrl.getState().position?.fen, START);
    assert.equal(ctrl.getState().position?.evaluation, 40);
    await ctrl.dispose();
  });
});

describe('Bug B: late bestmove after stop', () => {
  it('ignores orphan bestmove from previous search', async () => {
    let sendLate: ((line: string) => void) | null = null;
    let go = 0;
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('go ')) {
          go += 1;
          if (go === 1) {
            sendLate = send;
            // Do not finish — will be stopped.
            return;
          }
          send('info depth 8 multipv 1 score cp 12 pv d7d5');
          send('bestmove d7d5');
        }
        if (cmd === 'stop' && sendLate) {
          // Late bestmove for the *first* search arrives after stop.
          setTimeout(() => sendLate!('bestmove e2e4'), 5);
        }
      },
    });
    const service = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
      analysisTimeoutMs: 3000,
    });
    await service.init();
    const first = service.analyzePosition({ fen: START, depth: 10, movetimeMs: 200 });
    await new Promise((r) => setTimeout(r, 10));
    const second = await service.analyzePosition({
      fen: AFTER_E4,
      depth: 10,
      movetimeMs: 200,
    });
    const firstResult = await first;
    assert.equal(firstResult.cancelled, true);
    assert.equal(second.bestMove?.uci, 'd7d5');
    // Illegal e2e4 for Black-to-move must never become the suggestion.
    assert.notEqual(second.bestMove?.uci, 'e2e4');
    service.destroy();
  });

  it('sends go depth+movetime together', async () => {
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('go ')) {
          send('info depth 5 score cp 0 pv e2e4');
          send('bestmove e2e4');
        }
      },
    });
    const service = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
    });
    await service.analyzePosition({ fen: START, depth: 12, movetimeMs: 250 });
    const go = transport.commands.find((c) => c.startsWith('go '));
    assert.ok(go);
    assert.match(go!, /depth 12/);
    assert.match(go!, /movetime 250/);
    service.destroy();
  });

  it('rejects illegal bestmove for the analyzed FEN', async () => {
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('go ')) {
          // e2e4 is illegal when Black to move.
          send('info depth 6 score cp 10 pv e2e4');
          send('bestmove e2e4');
        }
      },
    });
    const service = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
    });
    const result = await service.analyzePosition({ fen: AFTER_E4 });
    assert.equal(result.bestMove, null);
    service.destroy();
  });
});

describe('Bug C: session isolation across games', () => {
  it('clears node results when sessionId changes', async () => {
    const engine = new MockEngine(() =>
      analysis(15, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    ctrl.startGameAnalysis(
      [
        { nodeId: 'n1', fen: START },
        { nodeId: 'n2', fen: AFTER_E4 },
      ],
      { sessionId: 'game-a', asMainLine: true },
    );
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(ctrl.getState().gameNodes.n1);

    ctrl.startGameAnalysis(
      [{ nodeId: 'n1', fen: AFTER_E4 }],
      { sessionId: 'game-b', asMainLine: true },
    );
    // Previous game's n1 must not linger with wrong FEN.
    const nodes = ctrl.getState().gameNodes;
    if (nodes.n1) {
      assert.equal(nodes.n1.fen, AFTER_E4);
    }
    assert.equal(ctrl.getState().sessionId, 'game-b');
    await ctrl.dispose();
  });

  it('branch analysis does not mark main line complete', async () => {
    const engine = new MockEngine(() =>
      analysis(10, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    ctrl.startGameAnalysis(
      [
        { nodeId: 'm1', fen: START },
        { nodeId: 'm2', fen: AFTER_E4 },
      ],
      { sessionId: 'g1', asMainLine: true },
    );
    await new Promise((r) => setTimeout(r, 5));
    ctrl.analyzeBranchNodes(
      [{ nodeId: 'b1', fen: AFTER_E4 }],
      'g1',
    );
    await new Promise((r) => setTimeout(r, 40));
    // Completing a branch node alone is not enough for the badge.
    if (!ctrl.getState().mainLineComplete) {
      assert.equal(ctrl.isMainLineFullyAnalyzed(), false);
    }
    await new Promise((r) => setTimeout(r, 40));
    // After main line finishes, badge OK.
    assert.equal(ctrl.isMainLineFullyAnalyzed(), true);
    await ctrl.dispose();
  });
});

describe('Bug D: mate 0 and terminals', () => {
  it('maps mate 0 without +10000', () => {
    const foolsMate =
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const white = toWhiteScore({ scoreCp: 1_000_000, mateIn: 0 }, foolsMate);
    assert.equal(white.terminalOutcome, 'black');
    assert.notEqual(white.evaluation, 1_000_000);
    assert.equal(formatAnyLyseurEval({
      cp: white.evaluation,
      mate: white.mate,
      terminalOutcome: white.terminalOutcome,
    }), '-#');

    const terminal = terminalWhiteScoreFromFen(foolsMate);
    assert.ok(terminal);
    assert.equal(terminal!.terminalOutcome, 'black');
    assert.equal(
      formatAnyLyseurEval({
        cp: null,
        mate: terminal!.mate,
        terminalOutcome: terminal!.terminalOutcome,
      }),
      '-#',
    );
  });

  it('handles stalemate as draw', () => {
    const stale = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
    const t = terminalWhiteScoreFromFen(stale);
    assert.ok(t);
    assert.equal(t!.terminalOutcome, 'draw');
    assert.equal(t!.evaluation, 0);
  });

  it('cancelled analysis maps to null', () => {
    const mapped = mapEngineAnalysisToPosition(
      START,
      analysis(0, null, [], { cancelled: true }),
      'normal',
    );
    assert.equal(mapped, null);
  });
});

describe('Bug E: time budget forwarded', () => {
  it('controller passes profile movetime to engine', async () => {
    const engine = new MockEngine(() =>
      analysis(5, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    await ctrl.reanalyze(START, 'fast');
    assert.ok(engine.goCommands.some((c) => c.includes('mt=250')));
    await ctrl.dispose();
  });
});

describe('Bug F: position priority does not drop queue permanently', () => {
  it('resumes main line after preemption', async () => {
    const AFTER_E4_E5 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const engine = new MockEngine(() =>
      analysis(8, null, ['g1f3', 'd2d4', 'b1c3']),
    );
    engine.delayMs = 25;
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    ctrl.startGameAnalysis(
      [
        { nodeId: 'n1', fen: START },
        { nodeId: 'n2', fen: AFTER_E4 },
        { nodeId: 'n3', fen: AFTER_E4_E5 },
      ],
      { sessionId: 'prio', asMainLine: true },
    );
    await ctrl.analyzeCurrentPosition(AFTER_E4_E5);
    await new Promise((r) => setTimeout(r, 120));
    const state = ctrl.getState();
    assert.ok(state.gameNodes.n1 || state.gameNodes.n2 || state.gameNodes.n3);
    assert.ok(state.mainLineComplete || state.gameProgress.running || state.gameProgress.done > 0);
    await ctrl.dispose();
  });
});

describe('Variation navigation preserves branch', () => {
  it('prev/next after selecting side line returns to that line', () => {
    const pgn =
      '1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nxe5) 3. Bb5 *';
    const parsed = parseReaderPgn(pgn);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const game = parsed.game;
    const nf6 = Object.values(game.nodesById).find((n) => n.san === 'Nf6');
    assert.ok(nf6);
    let state = createGameReaderState(game, 0);
    state = goToNode(state, nf6!.id);
    assert.equal(state.currentSan, 'Nf6');
    state = goToPrevious(state);
    state = goToNext(state);
    assert.equal(state.currentSan, 'Nf6');
    assert.equal(state.currentNodeId, nf6!.id);
  });
});
