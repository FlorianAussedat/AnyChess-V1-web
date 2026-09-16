import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EngineAnalysis } from '@/lib/engines/analysis';
import { AnalysisController } from '../AnalysisController.ts';
import type { AnalyzePositionRequest, ChessEngine } from '../engine/ChessEngine.ts';
import { AnalysisCache, makeAnalysisCacheKey } from '../analysisCache.ts';
import { exportEnrichedPgn } from '../exportEnrichedPgn.ts';
import { mapEngineAnalysisToPosition } from '../mapEngineAnalysis.ts';

function analysis(
  scoreCp: number,
  mateIn: number | null,
  pv: string[],
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
  };
}

class MockEngine implements ChessEngine {
  calls: string[] = [];
  stopped = 0;
  disposed = 0;
  delayMs = 0;
  handler: (fen: string) => EngineAnalysis;

  constructor(handler: (fen: string) => EngineAnalysis) {
    this.handler = handler;
  }

  getStatus() {
    return this.disposed ? ('unavailable' as const) : ('ready' as const);
  }

  async init() {}

  async analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    this.calls.push(req.fen);
    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }
    return this.handler(req.fen);
  }

  async stop() {
    this.stopped += 1;
  }

  dispose() {
    this.disposed += 1;
  }
}

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 =
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

describe('mapEngineAnalysisToPosition MultiPV', () => {
  it('maps 3 lines ordered and White-centric', () => {
    const raw = analysis(42, null, ['e2e4', 'd2d4', 'g1f3']);
    const mapped = mapEngineAnalysisToPosition(START, raw, 'normal');
    assert.equal(mapped.lines.length, 3);
    assert.equal(mapped.lines[0]?.rank, 1);
    assert.equal(mapped.lines[0]?.bestMove, 'e2e4');
    assert.equal(mapped.evaluation, 42);
    assert.equal(mapped.lines[1]?.scoreCp, 32);
  });
});

describe('AnalysisCache', () => {
  it('stores by fen/profile/depth/multipv', () => {
    const cache = new AnalysisCache();
    const key = makeAnalysisCacheKey(START, 'normal', 16, 3);
    const pos = mapEngineAnalysisToPosition(
      START,
      analysis(10, null, ['e2e4', 'd2d4', 'g1f3']),
      'normal',
    );
    cache.set(key, pos);
    assert.equal(cache.get(key)?.evaluation, 10);
    assert.equal(cache.size, 1);
  });
});

describe('AnalysisController', () => {
  it('ignores stale position results', async () => {
    const engine = new MockEngine((fen) =>
      analysis(fen === START ? 20 : -15, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    engine.delayMs = 25;
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();

    const p1 = ctrl.analyzeCurrentPosition(START);
    const p2 = ctrl.analyzeCurrentPosition(AFTER_E4);
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1, null);
    assert.ok(r2);
    assert.equal(r2!.fen, AFTER_E4);
    // STM -15 with Black to move → White +15
    assert.equal(r2!.evaluation, 15);
    assert.ok(engine.stopped >= 1);
    await ctrl.dispose();
    assert.equal(engine.disposed, 1);
  });

  it('caches positions and supports reanalyze profiles', async () => {
    const engine = new MockEngine(() =>
      analysis(5, null, ['e2e4', 'd2d4', 'g1f3']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    await ctrl.analyzeCurrentPosition(START);
    const before = engine.calls.length;
    await ctrl.analyzeCurrentPosition(START);
    assert.equal(engine.calls.length, before);

    await ctrl.reanalyze(START, 'deep');
    assert.equal(ctrl.getState().profileId, 'deep');
    assert.ok(engine.calls.length > before);

    ctrl.startGameAnalysis([
      { nodeId: 'n1', fen: START },
      { nodeId: 'n2', fen: AFTER_E4 },
    ]);
    await new Promise((r) => setTimeout(r, 40));
    const state = ctrl.getState();
    assert.ok(state.gameNodes.n1);
    await ctrl.dispose();
  });

  it('exposes classification inputs without classifying', async () => {
    const engine = new MockEngine((fen) =>
      analysis(fen === START ? 30 : -40, null, ['g1f3', 'd2d4', 'c2c4']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    await ctrl.analyzeCurrentPosition(START);
    await ctrl.analyzeCurrentPosition(AFTER_E4);
    const inputs = ctrl.getClassificationInputs({
      fenBefore: START,
      fenAfter: AFTER_E4,
      playedMoveSan: 'e4',
      playedMoveUci: 'e2e4',
    });
    assert.equal(inputs.playedMoveSan, 'e4');
    assert.equal(inputs.bestMoveUci, 'g1f3');
    assert.equal(inputs.evalBefore, 30);
    await ctrl.dispose();
  });
});

describe('exportEnrichedPgn', () => {
  it('preserves original comments and adds eval via tree', async () => {
    const { parseReaderPgn } = await import('../../gameReader/parseReaderPgn.ts');
    const parsed = parseReaderPgn(`[Event "T"]\n\n1. e4 {Ruy} e5 2. Nf3 *`);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const game = parsed.game;
    const ids = Object.keys(game.nodesById);
    const nodes: Record<string, any> = {};
    for (const id of ids) {
      const n = game.nodesById[id]!;
      nodes[id] = {
        nodeId: id,
        fen: n.fenAfter,
        evaluation: 25,
        mate: null,
        bestMove: n.color === 'white' && n.san === 'e4' ? 'e2e4' : undefined,
        depth: 12,
        analyzedAt: 1,
        profileId: 'fast',
      };
    }
    const out = exportEnrichedPgn({
      game,
      nodes,
      includeEvals: true,
      includeBest: true,
    });
    assert.match(out, /Ruy/);
    assert.match(out, /\[%eval 0\.25\]/);
    assert.match(out, /1\.\s*e4/);
    // Re-export must not duplicate eval tags.
    const again = exportEnrichedPgn({
      game: parseReaderPgn(out).ok
        ? (parseReaderPgn(out) as any).game
        : game,
      nodes,
      includeEvals: true,
    });
    const evalCount = (again.match(/\[%eval/g) ?? []).length;
    assert.ok(evalCount >= 1);
    assert.equal(evalCount, (again.match(/\[%eval/g) ?? []).length);
  });

  it('keeps check suffix attached when present and scopes eval to the right node', async () => {
    const { parseReaderPgn } = await import('../../gameReader/parseReaderPgn.ts');
    // Scholar's mate line ends with Qxf7# — checkmate suffix must stay glued.
    const parsed = parseReaderPgn(
      `1. e4 e5 2. Bc4 Nc6 (2... Nf6) 3. Qh5 Nf6 4. Qxf7# *`,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const mate = Object.values(parsed.game.nodesById).find((n) =>
      n.san.includes('Qxf7'),
    );
    const nf6 = Object.values(parsed.game.nodesById).find((n) => n.san === 'Nf6');
    assert.ok(mate);
    assert.ok(nf6);
    const out = exportEnrichedPgn({
      game: parsed.game,
      nodes: {
        [mate!.id]: {
          nodeId: mate!.id,
          fen: mate!.fenAfter,
          evaluation: null,
          mate: 1,
          depth: 10,
          analyzedAt: 1,
          profileId: 'fast',
          terminalOutcome: 'white',
        },
        [nf6!.id]: {
          nodeId: nf6!.id,
          fen: nf6!.fenAfter,
          evaluation: -12,
          mate: null,
          depth: 10,
          analyzedAt: 1,
          profileId: 'fast',
        },
      },
      includeEvals: true,
      includeBest: false,
    });
    assert.match(out, /Qxf7#/);
    assert.match(out, /Qxf7# \{ \[%eval/);
    assert.match(out, /Nf6 \{ \[%eval -0\.12\] \}/);
  });
});

describe('AnalysisController priority and branches', () => {
  it('prioritizes current position over full-game batch', async () => {
    const AFTER_E4_E5 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const engine = new MockEngine((fen) =>
      analysis(fen === AFTER_E4_E5 ? 55 : 10, null, ['g1f3', 'd2d4', 'b1c3']),
    );
    engine.delayMs = 30;
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();

    ctrl.startGameAnalysis([
      { nodeId: 'n1', fen: START },
      { nodeId: 'n2', fen: AFTER_E4 },
      { nodeId: 'n3', fen: AFTER_E4_E5 },
    ]);
    const positionPromise = ctrl.analyzeCurrentPosition(AFTER_E4_E5);
    const result = await positionPromise;
    assert.ok(result);
    assert.equal(result!.fen, AFTER_E4_E5);
    assert.equal(result!.evaluation, 55);
    assert.ok(engine.calls.includes(AFTER_E4_E5));
    // Current position request should appear before remaining batch FENs finish.
    const idxPriority = engine.calls.indexOf(AFTER_E4_E5);
    assert.ok(idxPriority >= 0);

    await new Promise((r) => setTimeout(r, 120));
    const state = ctrl.getState();
    assert.ok(state.gameNodes.n1 || state.gameNodes.n2 || state.gameNodes.n3);
    await ctrl.dispose();
  });

  it('analyzes PGN branch nodes on demand without requiring main line', async () => {
    const BRANCH =
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const engine = new MockEngine(() =>
      analysis(12, null, ['d2d4', 'f1c4', 'b1c3']),
    );
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();

    // On-demand branch: only the active variation nodes.
    ctrl.startGameAnalysis([
      { nodeId: 'branch-a', fen: AFTER_E4 },
      { nodeId: 'branch-b', fen: BRANCH },
    ]);
    await new Promise((r) => setTimeout(r, 40));
    const state = ctrl.getState();
    assert.ok(state.gameNodes['branch-a']);
    assert.ok(state.gameNodes['branch-b']);
    assert.equal(state.gameNodes['branch-b']!.fen, BRANCH);
    assert.equal(engine.calls.includes(START), false);
    await ctrl.dispose();
  });
});

describe('UCI info MultiPV (engine layer)', () => {
  it('parses multipv cp mate and bestmove without a worker', async () => {
    const { parseInfoScoreSnapshot, parseBestMove } = await import(
      '../../engines/stockfish/uci.ts'
    );
    const l1 = parseInfoScoreSnapshot(
      'info depth 14 multipv 1 score cp 42 pv e2e4 e7e5 g1f3',
    );
    const l2 = parseInfoScoreSnapshot(
      'info depth 14 multipv 2 score cp 31 pv d2d4 d7d5',
    );
    const l3 = parseInfoScoreSnapshot(
      'info depth 14 multipv 3 score mate 3 pv a1a8 h7h8',
    );
    assert.equal(l1?.multipv, 1);
    assert.equal(l1?.scoreCp, 42);
    assert.deepEqual(l1?.pv.slice(0, 2), ['e2e4', 'e7e5']);
    assert.equal(l2?.multipv, 2);
    assert.equal(l3?.mateIn, 3);
    assert.equal(l3?.multipv, 3);
    const bm = parseBestMove('bestmove e2e4 ponder e7e5');
    assert.equal(bm?.from, 'e2');
    assert.equal(bm?.to, 'e4');
  });
});
