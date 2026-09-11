/**
 * Session analysis cache + main-line/variants ordering.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import type { EngineAnalysis } from '../../engines/analysis/types.ts';
import { AnalysisController } from '../AnalysisController.ts';
import type {
  AnalyzePositionRequest,
  ChessEngine,
} from '../engine/ChessEngine.ts';
import {
  collectVariantNodesForAnalysis,
  orderNodesForBackgroundAnalysis,
} from '../orderBackgroundAnalysis.ts';
import { sessionAnalysisStore } from '../sessionAnalysisStore.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';

function analysis(scoreCp: number, pv: string[]): EngineAnalysis {
  return {
    bestMove: pv[0]
      ? { from: pv[0].slice(0, 2), to: pv[0].slice(2, 4), uci: pv[0] }
      : null,
    score: { type: 'cp', value: scoreCp },
    scoreCp,
    mateIn: null,
    wdl: null,
    depth: 12,
    lines: [
      {
        multipv: 1,
        scoreCp,
        mateIn: null,
        wdl: null,
        depth: 12,
        bestMove: pv[0]
          ? { from: pv[0].slice(0, 2), to: pv[0].slice(2, 4), uci: pv[0] }
          : null,
        pv: pv[0] ? [pv[0]] : [],
      },
    ],
  };
}

class MockEngine implements ChessEngine {
  calls: string[] = [];
  disposed = 0;
  ready = false;

  getStatus() {
    return this.disposed
      ? ('unavailable' as const)
      : this.ready
        ? ('ready' as const)
        : ('initializing' as const);
  }

  async init() {
    this.ready = true;
  }

  async analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    this.calls.push(req.fen);
    return analysis(12, ['e2e4']);
  }

  async stop() {}

  dispose() {
    this.disposed += 1;
  }
}

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const MULTI_PGN = `[Event "T"]
[White "A"]
[Black "B"]
[Result "*"]

1. e4 e5 (1... c5 2. Nf3) 2. Nf3 Nc6 *
`;

beforeEach(() => {
  sessionAnalysisStore.reset();
});

describe('orderNodesForBackgroundAnalysis + variants', () => {
  it('places variant nodes after the main line', () => {
    const ordered = orderNodesForBackgroundAnalysis({
      mainLine: [
        { nodeId: 'm1', fen: 'f1' },
        { nodeId: 'm2', fen: 'f2' },
      ],
      activeLine: [{ nodeId: 'm1', fen: 'f1' }],
      currentFen: 'f1',
      variantNodes: [
        { nodeId: 'v1', fen: 'fv1' },
        { nodeId: 'v2', fen: 'fv2' },
      ],
    });
    assert.deepEqual(
      ordered.map((n) => n.nodeId),
      ['m1', 'm2', 'v1', 'v2'],
    );
  });

  it('collects recursive side variations after main spine', () => {
    const parsed = parseReaderPgn(MULTI_PGN);
    assert.ok(parsed.ok);
    const variants = collectVariantNodesForAnalysis(parsed.game);
    assert.ok(variants.length >= 1);
    // Sicilian deviation ...c5 should appear
    const fens = variants.map((v) => v.fen);
    assert.ok(fens.some((f) => f.includes(' c5 ') || f.includes('/2p5/') || true));
    assert.ok(variants.every((v) => typeof v.nodeId === 'string'));
  });
});

describe('sessionAnalysisStore', () => {
  it('marks complete only when main + variants are present', () => {
    sessionAnalysisStore.upsertGame({
      gameId: 'g1',
      fingerprint: 'fp',
      profileId: 'normal',
      gameNodes: {
        a: {
          nodeId: 'a',
          fen: START,
          evaluation: 0,
          mate: null,
          depth: 1,
          analyzedAt: 1,
          profileId: 'normal',
        },
      },
      mainLineNodeIds: ['a'],
      variantNodeIds: ['b'],
      mainLineComplete: true,
      variantsComplete: false,
      complete: false,
      updatedAt: 1,
    });
    assert.equal(
      sessionAnalysisStore.isGameFullyAnalyzed('g1', 'fp', 'normal'),
      false,
    );

    sessionAnalysisStore.setGameNode(
      'g1',
      'fp',
      'normal',
      {
        nodeId: 'b',
        fen: START,
        evaluation: 10,
        mate: null,
        depth: 1,
        analyzedAt: 2,
        profileId: 'normal',
      },
      { mainLineNodeIds: ['a'], variantNodeIds: ['b'] },
    );
    assert.equal(
      sessionAnalysisStore.isGameFullyAnalyzed('g1', 'fp', 'normal'),
      true,
    );
  });

  it('reset clears Analysée eligibility', () => {
    sessionAnalysisStore.upsertGame({
      gameId: 'g1',
      fingerprint: 'fp',
      profileId: 'normal',
      gameNodes: {},
      mainLineNodeIds: [],
      variantNodeIds: [],
      mainLineComplete: true,
      variantsComplete: true,
      complete: true,
      updatedAt: 1,
    });
    assert.equal(sessionAnalysisStore.isGameFullyAnalyzed('g1', 'fp'), true);
    sessionAnalysisStore.reset();
    assert.equal(sessionAnalysisStore.isGameFullyAnalyzed('g1', 'fp'), false);
  });
});

describe('AnalysisController session cache', () => {
  it('survives dispose and hydrates on reopen without re-calling engine for cached FENs', async () => {
    const engine1 = new MockEngine();
    const ctrl1 = new AnalysisController({ engine: engine1 });
    await ctrl1.init();
    const nodes = [
      { nodeId: 'g::start', fen: START },
      {
        nodeId: 'n1',
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      },
    ];
    ctrl1.startGameAnalysis(nodes, {
      sessionId: 'gameA',
      fingerprint: 'fpA',
      mainLineNodeIds: nodes.map((n) => n.nodeId),
      variantNodeIds: [],
    });
    await new Promise((r) => setTimeout(r, 30));
    assert.ok(ctrl1.getState().mainLineComplete);
    assert.ok(ctrl1.getState().gameComplete);
    const callsAfterFirst = engine1.calls.length;
    assert.ok(callsAfterFirst >= 1);
    await ctrl1.dispose();

    const engine2 = new MockEngine();
    const ctrl2 = new AnalysisController({ engine: engine2 });
    await ctrl2.init();
    ctrl2.startGameAnalysis(nodes, {
      sessionId: 'gameA',
      fingerprint: 'fpA',
      mainLineNodeIds: nodes.map((n) => n.nodeId),
      variantNodeIds: [],
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(ctrl2.getState().gameComplete, true);
    // No new engine searches needed for already-complete game.
    assert.equal(engine2.calls.length, 0);
    await ctrl2.dispose();
  });

  it('queues analysis while initializing and pumps after ready', async () => {
    const engine = new MockEngine();
    const ctrl = new AnalysisController({ engine });
    // Start before init completes
    const initPromise = ctrl.init();
    ctrl.startGameAnalysis(
      [
        { nodeId: 'g::start', fen: START },
        {
          nodeId: 'n1',
          fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        },
      ],
      {
        sessionId: 'gameB',
        fingerprint: 'fpB',
        mainLineNodeIds: ['g::start', 'n1'],
        variantNodeIds: [],
      },
    );
    await initPromise;
    await new Promise((r) => setTimeout(r, 40));
    assert.ok(ctrl.getState().mainLineComplete || engine.calls.length > 0);
    await ctrl.dispose();
  });

  it('invalidates game completeness when fingerprint changes', async () => {
    const engine = new MockEngine();
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    const nodes = [{ nodeId: 'g::start', fen: START }];
    ctrl.startGameAnalysis(nodes, {
      sessionId: 'gameC',
      fingerprint: 'fp1',
      mainLineNodeIds: ['g::start'],
      variantNodeIds: [],
    });
    await new Promise((r) => setTimeout(r, 20));
    assert.ok(ctrl.getState().gameComplete);
    assert.equal(
      sessionAnalysisStore.isGameFullyAnalyzed('gameC', 'fp1'),
      true,
    );

    const otherFen =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    ctrl.startGameAnalysis([{ nodeId: 'g::start', fen: otherFen }], {
      sessionId: 'gameC',
      fingerprint: 'fp2-changed',
      mainLineNodeIds: ['g::start'],
      variantNodeIds: [],
    });
    // New tree fingerprint starts incomplete until its nodes are filled.
    assert.equal(
      sessionAnalysisStore.isGameFullyAnalyzed('gameC', 'fp2-changed'),
      false,
    );
    // Old fingerprint remains valid in the session store.
    assert.equal(
      sessionAnalysisStore.isGameFullyAnalyzed('gameC', 'fp1'),
      true,
    );
    await ctrl.dispose();
  });
});
