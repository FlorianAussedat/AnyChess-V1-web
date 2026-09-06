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
  it('preserves original comments and adds eval', () => {
    const raw = `[Event "T"]\n\n1. e4 {Ruy} e5 2. Nf3 *`;
    const out = exportEnrichedPgn({
      rawPgn: raw,
      mainLineNodeIds: ['a', 'b', 'c'],
      nodes: {
        a: {
          nodeId: 'a',
          fen: START,
          evaluation: 25,
          mate: null,
          bestMove: 'e2e4',
          depth: 12,
          analyzedAt: 1,
          profileId: 'fast',
        },
        b: {
          nodeId: 'b',
          fen: AFTER_E4,
          evaluation: 20,
          mate: null,
          depth: 12,
          analyzedAt: 1,
          profileId: 'fast',
        },
        c: {
          nodeId: 'c',
          fen: START,
          evaluation: 15,
          mate: null,
          depth: 12,
          analyzedAt: 1,
          profileId: 'fast',
        },
      },
      fenBeforeByNodeId: { a: START },
    });
    assert.match(out, /Ruy/);
    assert.match(out, /\[%eval 0\.25\]/);
    assert.match(out, /Best: e4/);
  });
});
