/**
 * Selected-move review, live focus, arrows, and the eval curve.
 * Node tests — not an Android device run.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import type { EngineAnalysis } from '@/lib/engines/analysis';
import { AnalysisController } from '../AnalysisController.ts';
import type { AnalyzePositionRequest, ChessEngine } from '../engine/ChessEngine.ts';
import { mapEngineAnalysisToPosition } from '../mapEngineAnalysis.ts';
import { sessionAnalysisStore } from '../sessionAnalysisStore.ts';
import { getAnalysisProfile } from '../profiles.ts';
import {
  buildLiveFocus,
  buildSelectedMoveReview,
  legalSuggestions,
  resolveBoardPresentation,
  singleBestArrow,
} from '../reviewFocus.ts';
import {
  hitTestCurve,
  layoutEvalCurve,
  layoutInsidePlot,
  segmentFrame,
  type CurveSample,
} from '../evalCurveLayout.ts';
import { arrowSegment } from '../boardArrowGeometry.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import { collectActiveLineNodes, collectMainLineNodes } from '../mainLineNodes.ts';
import type { PositionAnalysis } from '../types.ts';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
const AFTER_E4_C5 = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';

function raw(
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
    lines: pv.map((uci, index) => ({
      multipv: index + 1,
      scoreCp: mateIn != null && index === 0 ? scoreCp : scoreCp - index * 15,
      mateIn: index === 0 ? mateIn : null,
      wdl: null,
      depth: 12,
      bestMove: { from: uci.slice(0, 2), to: uci.slice(2, 4), uci },
      pv: [uci],
    })),
    ...extra,
  };
}

function stamp(fen: string, partial: Partial<PositionAnalysis> & Pick<PositionAnalysis, 'lines'>): PositionAnalysis {
  return {
    fen,
    depth: 12,
    analyzedAt: 1,
    profileId: 'fast',
    evaluation: partial.evaluation ?? null,
    mate: partial.mate ?? null,
    bestMove: partial.bestMove,
    terminalOutcome: partial.terminalOutcome,
    evalPerspective: 'white',
    lines: partial.lines,
  };
}

class DeferredEngine implements ChessEngine {
  waiters: Array<{ fen: string; resolve: (value: EngineAnalysis) => void }> = [];
  disposed = 0;
  getStatus() {
    return this.disposed ? ('unavailable' as const) : ('ready' as const);
  }
  async init() {}
  analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    return new Promise((resolve) => {
      this.waiters.push({ fen: req.fen, resolve });
    });
  }
  async stop() {}
  dispose() {
    this.disposed += 1;
  }
  finish(fen: string, value: EngineAnalysis) {
    const index = this.waiters.findIndex((waiter) => waiter.fen === fen);
    assert.ok(index >= 0);
    const waiter = this.waiters.splice(index, 1)[0]!;
    waiter.resolve(value);
  }
}

class SlowEngine implements ChessEngine {
  calls: string[] = [];
  delayMs: number;
  handler: (fen: string) => EngineAnalysis;
  constructor(handler: (fen: string) => EngineAnalysis, delayMs = 20) {
    this.handler = handler;
    this.delayMs = delayMs;
  }
  getStatus() {
    return 'ready' as const;
  }
  async init() {}
  async analyzePosition(req: AnalyzePositionRequest): Promise<EngineAnalysis> {
    this.calls.push(req.fen);
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return this.handler(req.fen);
  }
  async stop() {}
  dispose() {}
}

describe('selected move review', () => {
  it('keeps White and Black alternatives on the position before the selected move', () => {
    const before = mapEngineAnalysisToPosition(
      START,
      raw(30, null, ['e2e4', 'd2d4', 'g1f3']),
      'fast',
    )!;
    const after = mapEngineAnalysisToPosition(
      AFTER_E4,
      raw(-20, null, ['c7c5', 'e7e5', 'c7c6']),
      'fast',
    )!;
    const review = buildSelectedMoveReview({
      fenBefore: START,
      fenAfter: AFTER_E4,
      playedSan: 'e4',
      playedUci: 'e2e4',
      before,
      after,
    });
    assert.equal(review.side, 'w');
    assert.equal(review.playedSan, 'e4');
    assert.equal(review.bestSan, 'e4');
    assert.equal(review.before?.cp, 30);
    assert.equal(review.after?.cp, 20);
    assert.ok(review.possibilities.every((row) => row.san !== 'e4'));
    assert.ok(review.possibilities.every((row) => !row.san.startsWith('c') && row.san !== 'e5'));
    assert.deepEqual(
      review.possibilities.map((row) => row.san),
      ['d4', 'Nf3'],
    );

    const black = buildSelectedMoveReview({
      fenBefore: AFTER_E4,
      fenAfter: AFTER_E4_C5,
      playedSan: 'c5',
      playedUci: 'c7c5',
      before: after,
      after: stamp(AFTER_E4_C5, { lines: [], evaluation: 10, mate: null }),
    });
    assert.equal(black.side, 'b');
    assert.equal(black.bestSan, 'c5');
    assert.deepEqual(
      black.possibilities.map((row) => row.san),
      ['e5', 'c6'],
    );
    assert.equal(black.after?.cp, 10);
  });

  it('does not invent a move line from a mate without a legal variation', () => {
    const mapped = mapEngineAnalysisToPosition(
      START,
      raw(10000, 8, ['a1a2', 'h1h2']),
      'fast',
    )!;
    assert.equal(mapped.mate, 8);
    assert.equal(mapped.evalPerspective, 'white');
    assert.equal(mapped.lines.length, 0);
    assert.equal(mapped.bestMove, undefined);
    const rows = legalSuggestions(START, mapped.lines);
    assert.deepEqual(rows, []);
    assert.equal(singleBestArrow(START, mapped), null);
    const review = buildSelectedMoveReview({
      fenBefore: START,
      fenAfter: AFTER_E4,
      playedSan: 'e4',
      playedUci: 'e2e4',
      before: mapped,
      after: null,
    });
    assert.equal(review.bestSan, null);
    assert.equal(review.before?.mate, 8);
    assert.equal(review.possibilities.length, 0);
  });

  it('ignores an analysis whose perspective or FEN does not match', () => {
    const foreign = stamp(AFTER_E4, {
      lines: [
        {
          rank: 1,
          depth: 8,
          scoreCp: null,
          mate: -8,
          pv: ['c7c5'],
          bestMove: 'c7c5',
        },
      ],
      mate: -8,
      bestMove: 'c7c5',
    });
    foreign.evalPerspective = undefined;
    const review = buildSelectedMoveReview({
      fenBefore: START,
      fenAfter: AFTER_E4,
      playedSan: 'e4',
      playedUci: 'e2e4',
      before: foreign,
      after: foreign,
    });
    assert.equal(review.before, null);
    assert.equal(review.after, null);
    assert.equal(review.arrow, null);
    assert.equal(singleBestArrow(START, foreign), null);
  });

  it('flips successive STM mates into one White-centric sign', () => {
    const whiteTurn = mapEngineAnalysisToPosition(
      START,
      raw(0, 4, ['e2e4']),
      'fast',
    )!;
    const blackTurn = mapEngineAnalysisToPosition(
      AFTER_E4,
      raw(0, -3, ['c7c5']),
      'fast',
    )!;
    assert.equal(whiteTurn.mate, 4);
    assert.equal(blackTurn.mate, 3);
    assert.ok((whiteTurn.mate ?? 0) > 0 && (blackTurn.mate ?? 0) > 0);
  });

  it('distinguishes a terminal position from an empty analysis', () => {
    const mate = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const mapped = mapEngineAnalysisToPosition(mate, raw(0, 1, ['f2f3']), 'fast')!;
    assert.equal(mapped.terminalOutcome, 'black');
    assert.equal(mapped.lines.length, 0);
    assert.equal(singleBestArrow(mate, mapped), null);
    const live = buildLiveFocus(mate, mapped);
    assert.equal(live.terminal, true);
    assert.equal(live.possibilities.length, 0);
    assert.equal(mapEngineAnalysisToPosition(START, raw(0, null, [], { score: null, lines: [], bestMove: null, cancelled: false }), 'fast'), null);
  });
});

describe('one arrow and the preview', () => {
  it('draws only the first legal best move, including castling, capture, and promotion', () => {
    const castle = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    const analysis = mapEngineAnalysisToPosition(
      castle,
      raw(40, null, ['e1g1', 'e1c1', 'h1f1']),
      'fast',
    )!;
    assert.deepEqual(singleBestArrow(castle, analysis), { from: 'e1', to: 'g1' });
    const captureFen = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2';
    const capture = mapEngineAnalysisToPosition(
      captureFen,
      raw(10, null, ['e4d5', 'e2e3']),
      'fast',
    )!;
    assert.equal(capture.lines[0]?.bestMove, 'e4d5');
    const promoFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    const promo = mapEngineAnalysisToPosition(
      promoFen,
      raw(0, 2, ['a7a8q']),
      'fast',
    )!;
    assert.deepEqual(singleBestArrow(promoFen, promo), { from: 'a7', to: 'a8' });
    assert.equal(promo.lines.length, 1);
  });

  it('orients both camps without changing the move squares', () => {
    const quiet = arrowSegment('e2', 'e4', { flipped: false, cellSize: 40 });
    const flipped = arrowSegment('e2', 'e4', { flipped: true, cellSize: 40 });
    assert.ok(quiet && flipped);
    assert.notEqual(quiet.y1, flipped.y1);
    for (const segment of [quiet, flipped]) {
      for (const value of [segment.x1, segment.y1, segment.x2, segment.y2]) {
        assert.ok(Number.isFinite(value));
        assert.ok(value >= 0 && value <= 320);
      }
    }
    const castle = arrowSegment('e1', 'g1', { flipped: false, cellSize: 40 })!;
    assert.equal(castle.y1, castle.y2);
    assert.ok(castle.x2 > castle.x1);
    const blackCastle = arrowSegment('e8', 'c8', { flipped: true, cellSize: 40 })!;
    assert.ok(Number.isFinite(blackCastle.x1) && Number.isFinite(blackCastle.x2));
  });

  it('previews the position before the selected move and restores it without touching the node', () => {
    const selected = { fenBefore: START, fenAfter: AFTER_E4, san: 'e4' };
    const frozen = Object.freeze({ ...selected });
    const on = resolveBoardPresentation({
      mode: 'replay',
      arrowsEnabled: true,
      liveFen: AFTER_E4,
      selected: frozen,
    });
    assert.equal(on.fen, START);
    assert.equal(on.preview, true);
    const off = resolveBoardPresentation({
      mode: 'replay',
      arrowsEnabled: false,
      liveFen: AFTER_E4,
      selected: frozen,
    });
    assert.equal(off.fen, AFTER_E4);
    assert.equal(off.preview, false);
    const live = resolveBoardPresentation({
      mode: 'live',
      arrowsEnabled: true,
      liveFen: AFTER_E4_C5,
      selected: frozen,
    });
    assert.equal(live.fen, AFTER_E4_C5);
    assert.equal(live.preview, false);
    assert.equal(frozen.san, 'e4');
  });
});

describe('eval curve layout', () => {
  function series(count: number, missingAt?: number): CurveSample[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      fen: index % 2 === 0 ? START : AFTER_E4,
      moveNumber: 30 + Math.floor(index / 2),
      plyColor: index % 2 === 0 ? 'w' : 'b',
      evaluation: missingAt === index ? null : index === 3 ? 2500 : 20 - index,
      mate: index === 4 ? 8 : index === 5 ? -2 : null,
      terminalOutcome: undefined,
    }));
  }

  it('keeps points and segments inside narrow and wide plots', () => {
    for (const width of [48, 120, 360, 960]) {
      for (const samples of [[], series(1), series(90), series(12, 4)]) {
        const layout = layoutEvalCurve(samples, width, 96);
        assert.equal(layoutInsidePlot(layout), true);
        if (samples.length === 0) assert.equal(layout.points.length, 0);
      }
    }
  });

  it('breaks the line on missing data and caps mates without using the raw score', () => {
    const layout = layoutEvalCurve(series(8, 2), 400, 96);
    assert.equal(layout.points[2]?.y, null);
    assert.equal(layout.points[2]?.exactLabel, null);
    assert.ok(layout.segments.every((segment) => segment.x1 !== layout.points[2]?.x && segment.x2 !== layout.points[2]?.x));
    const mate = layout.points[4]!;
    assert.equal(mate.kind, 'mate');
    assert.equal(mate.exactLabel, 'M8');
    assert.equal(layout.scaleCapped, true);
    assert.equal(layout.points[3]?.exactLabel, '+25.00');
    assert.ok((layout.points[3]?.y ?? 0) < layout.equalityY);
    const frame = segmentFrame(layout.segments[0]!);
    assert.ok(Number.isFinite(frame.angle));
  });

  it('uses PGN move numbers and hits the nearest node', () => {
    const parsed = parseReaderPgn(`[SetUp "1"]
[FEN "4k3/8/8/8/8/8/8/4K3 w - - 0 30"]

30. Ke2 Ke7 31. Kd3 Kd6 *`);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const nodes = collectMainLineNodes(parsed.game);
    assert.ok(nodes.length >= 4);
    assert.equal(nodes[0]?.moveNumber, 30);
    assert.equal(nodes[0]?.color, 'white');
    assert.equal(nodes[2]?.moveNumber, 31);
    const samples: CurveSample[] = nodes.map((node) => ({
      id: node.nodeId,
      fen: node.fen,
      moveNumber: node.moveNumber,
      plyColor: node.color === 'white' ? 'w' : 'b',
      evaluation: 12,
      mate: null,
    }));
    const layout = layoutEvalCurve(samples, 480, 96);
    assert.equal(layout.ticks[0]?.label, '30');
    assert.ok(layout.ticks.some((tick) => tick.label === '31'));
    assert.equal(hitTestCurve(layout, layout.points[2]!.x), nodes[2]?.nodeId);
    assert.equal(layout.points[2]?.fen, nodes[2]?.fen);
  });

  it('follows the variation being viewed, including a long game', () => {
    const chess = new Chess();
    const sans: string[] = [];
    while (sans.length < 92 && !chess.isGameOver()) {
      const moves = chess.moves();
      const next = moves[sans.length % moves.length]!;
      chess.move(next);
      sans.push(next);
    }
    assert.ok(sans.length > 45);
    const parsed = parseReaderPgn(chess.pgn());
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const main = collectMainLineNodes(parsed.game);
    assert.ok(main.length > 45);
    const layout = layoutEvalCurve(
      main.map((node, index) => ({
        id: node.nodeId,
        fen: node.fen,
        moveNumber: node.moveNumber,
        plyColor: node.color === 'white' ? 'w' : 'b',
        evaluation: index % 7 === 0 ? null : 15,
        mate: null,
      })),
      280,
      96,
    );
    assert.equal(layoutInsidePlot(layout), true);
    assert.equal(layout.points.length, main.length);
    assert.equal(layout.points.at(-1)?.moveNumber, main.at(-1)?.moveNumber);
    assert.ok(layout.points.some((point) => point.y == null));

    const branched = parseReaderPgn('1. e4 e5 (1... c5) 2. Nf3 *');
    assert.equal(branched.ok, true);
    if (!branched.ok) return;
    const variation = Object.values(branched.game.nodesById).find((node) => node.san === 'c5');
    assert.ok(variation);
    const active = collectActiveLineNodes(branched.game, [variation!.id]);
    assert.equal(active[0]?.san, 'c5');
    assert.equal(active[0]?.color, 'black');
    assert.notEqual(active[0]?.fenBefore, active[0]?.fen);
  });
});

describe('analysis binding', () => {
  it('drops late results and does not copy another game', async () => {
    sessionAnalysisStore.reset();
    const engine = new DeferredEngine();
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    const first = ctrl.analyzeCurrentPosition(START);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = ctrl.analyzeCurrentPosition(AFTER_E4);
    await new Promise((resolve) => setTimeout(resolve, 0));
    engine.finish(START, raw(80, null, ['e2e4', 'd2d4']));
    engine.finish(AFTER_E4, raw(-40, null, ['c7c5', 'e7e5']));
    const [left, right] = await Promise.all([first, second]);
    assert.equal(left, null);
    assert.equal(right?.fen, AFTER_E4);
    assert.equal(ctrl.getState().position?.fen, AFTER_E4);
    assert.equal(ctrl.getState().position?.evaluation, 40);
    await ctrl.dispose();

    const batch = new SlowEngine((fen) =>
      raw(fen === START ? 11 : 22, null, fen === START ? ['e2e4'] : ['c7c5']),
    );
    const games = new AnalysisController({ engine: batch });
    await games.init();
    games.startGameAnalysis([{ nodeId: 'a1', fen: START }], {
      sessionId: 'game-a',
      fingerprint: 'game-a',
    });
    games.startGameAnalysis([{ nodeId: 'b1', fen: AFTER_E4 }], {
      sessionId: 'game-b',
      fingerprint: 'game-b',
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const state = games.getState();
    assert.equal(state.sessionId, 'game-b');
    assert.equal(state.gameNodes.a1, undefined);
    assert.equal(state.gameNodes.b1?.fen, AFTER_E4);
    assert.equal(state.gameNodes.b1?.evalPerspective, 'white');
    await games.dispose();
  });

  it('recomputes a stored analysis with an unknown perspective', async () => {
    sessionAnalysisStore.reset();
    const profile = getAnalysisProfile('fast');
    const stale = stamp(START, {
      lines: [],
      evaluation: 999,
      mate: null,
      bestMove: 'e2e4',
    });
    stale.evalPerspective = undefined;
    sessionAnalysisStore.setPosition(START, profile.id, profile.depth, profile.multiPv, stale);
    assert.equal(
      sessionAnalysisStore.getPosition(START, profile.id, profile.depth, profile.multiPv),
      undefined,
    );
    sessionAnalysisStore.upsertGame({
      gameId: 'kept',
      fingerprint: 'kept',
      profileId: 'fast',
      gameNodes: {
        n1: {
          nodeId: 'n1',
          fen: START,
          evaluation: 999,
          mate: null,
          depth: 1,
          analyzedAt: 1,
          profileId: 'fast',
        },
      },
      mainLineNodeIds: ['n1'],
      variantNodeIds: [],
      mainLineComplete: true,
      variantsComplete: true,
      complete: true,
      updatedAt: 1,
    });
    const engine = new SlowEngine(() => raw(17, null, ['e2e4', 'd2d4']), 0);
    const ctrl = new AnalysisController({ engine });
    await ctrl.init();
    ctrl.startGameAnalysis([{ nodeId: 'n1', fen: START }], {
      sessionId: 'kept',
      fingerprint: 'kept',
    });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(ctrl.getState().gameNodes.n1?.evaluation, 17);
    assert.equal(ctrl.getState().gameNodes.n1?.evalPerspective, 'white');
    assert.notEqual(ctrl.getState().gameNodes.n1?.evaluation, 999);
    await ctrl.dispose();
    sessionAnalysisStore.reset();
  });
});
