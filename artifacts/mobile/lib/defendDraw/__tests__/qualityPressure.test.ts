/**
 * Quality filters, similarity, and practical-pressure opponent policy tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateEndgameQuality,
  shouldRejectForQuality,
  inferTrainingStyle,
} from '../qualityFilter.ts';
import {
  isBareHeavySymmetry,
  materialSignature,
  similarityKey,
} from '../materialSignature.ts';
import {
  pickPracticalPressureMove,
  chooseOpponentMove,
  resolveOpponentPolicy,
} from '../practicalPressure.ts';
import { CERTIFIED_DEFEND_DRAW_POSITIONS } from '../positions.ts';
import { suggestDefendDrawDifficulty } from '../builder/suggestDifficulty.ts';
import type { EngineAnalysisLine } from '../../engines/analysis/types.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('bare heavy symmetry / DD-113 regression', () => {
  it('flags Q vs Q with no pawns', () => {
    const fen = '6Q1/2q5/8/8/K7/8/3k4/8 b - - 0 1';
    assert.equal(isBareHeavySymmetry(fen), true);
    assert.equal(materialSignature(fen), 'KQ-kq');
  });

  it('rejects DD-113 style position without override', () => {
    const fen = '6Q1/2q5/8/8/K7/8/3k4/8 b - - 0 1';
    const q = evaluateEndgameQuality({
      fen,
      family: 'queen',
      playerColor: 'b',
      theme: 'queen-ending',
      metrics: {
        legalMoves: 31,
        drawingMoves: 21,
        losingMoves: 10,
        drawingRatio: 0.677,
        criticalMoves: 0,
        uniqueMoveMoments: 0,
      },
    });
    assert.equal(shouldRejectForQuality(q), true);
    assert.ok(q.rejectionReasons.includes('bare-heavy-symmetry'));
  });

  it('DD-113 is absent from the generated pool', () => {
    assert.equal(
      CERTIFIED_DEFEND_DRAW_POSITIONS.some((p) => p.id === 'DD-113'),
      false,
    );
    const src = read('lib/defendDraw/data/pool.generated.ts');
    assert.doesNotMatch(src, /id: 'DD-113'/);
  });
});

describe('quality filter keeps technical pawn endings', () => {
  it('does not reject K+P vs K technical holds', () => {
    const fen = '8/8/8/k7/8/K7/P7/8 b - - 0 1';
    const q = evaluateEndgameQuality({
      fen,
      family: 'pawn',
      playerColor: 'b',
      theme: 'kpvk',
      trainingStyle: 'technical',
      metrics: {
        legalMoves: 3,
        drawingMoves: 3,
        losingMoves: 0,
        drawingRatio: 1,
        criticalMoves: 0,
        uniqueMoveMoments: 0,
      },
    });
    assert.equal(q.immediateLiquidation, false);
    assert.equal(shouldRejectForQuality(q), false);
  });
});

describe('similarity keys', () => {
  it('shares material family for near-duplicates', () => {
    const a = similarityKey({
      fen: '8/8/8/k7/8/K7/P7/8 b - - 0 1',
      family: 'pawn',
      playerColor: 'b',
      trainingStyle: 'technical',
    });
    const b = similarityKey({
      fen: '8/8/8/1k6/8/1K6/1P6/8 b - - 0 1',
      family: 'pawn',
      playerColor: 'b',
      trainingStyle: 'technical',
    });
    assert.equal(a.split('|')[0], b.split('|')[0]);
    assert.equal(a.split('|')[1], 'pawn');
  });
});

describe('difficulty suggestion without material→GM bias', () => {
  it('does not promote Q vs R bare to GM from material alone', () => {
    const fen = '8/8/8/4k3/8/4K3/8/3q3R w - - 0 1';
    const d = suggestDefendDrawDifficulty({
      fen,
      family: 'imbalanced',
      metrics: {
        legalMoves: 10,
        drawingMoves: 4,
        losingMoves: 6,
        drawingRatio: 0.4,
        criticalMoves: 0,
        uniqueMoveMoments: 0,
      },
      qualityScore: 40,
    });
    assert.notEqual(d, 'grandMaitre');
  });

  it('requires unique+critical signals for GM', () => {
    const fen = '8/8/8/4k3/8/4K3/4P3/8 w - - 0 1';
    const d = suggestDefendDrawDifficulty({
      fen,
      family: 'pawn',
      metrics: {
        legalMoves: 5,
        drawingMoves: 1,
        losingMoves: 4,
        drawingRatio: 0.2,
        criticalMoves: 0,
        uniqueMoveMoments: 0,
      },
      qualityScore: 60,
    });
    assert.notEqual(d, 'grandMaitre');
  });
});

describe('practical-pressure policy', () => {
  it('uses practical-pressure for DRAW and strict-best for WIN', () => {
    assert.equal(resolveOpponentPolicy('DRAW'), 'practical-pressure');
    assert.equal(resolveOpponentPolicy('WIN'), 'strict-best');
  });

  it('prefers a pressure move over equalizing liquidation', () => {
    // Inspired by DD-113: Q trade vs keeping queens
    const fen = '6Q1/2q5/8/8/K7/8/3k4/8 b - - 0 1';
    const lines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 100, draw: 800, loss: 100 },
        depth: 20,
        bestMove: { from: 'c7', to: 'g3', uci: 'c7g3' }, // check / keep queens
      },
      {
        multipv: 2,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 80, draw: 840, loss: 80 },
        depth: 20,
        bestMove: { from: 'c7', to: 'g7', uci: 'c7g7' }, // also non-trade
      },
    ];
    // Add a liquidating alternative with same CP
    lines.push({
      multipv: 3,
      scoreCp: 0,
      mateIn: null,
      wdl: { win: 50, draw: 900, loss: 50 },
      depth: 20,
      bestMove: { from: 'c7', to: 'g3', promotion: undefined, uci: 'c7g3' },
    });

    // Synthetic: liquidating capture of queen if available
    const withTrade: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 5,
        mateIn: null,
        wdl: { win: 50, draw: 900, loss: 50 },
        depth: 18,
        // Qg8xc7 would trade — use a move that captures queen if legal
        bestMove: { from: 'g8', to: 'c4', uci: 'g8c4' },
      },
      {
        multipv: 2,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 80, draw: 850, loss: 70 },
        depth: 18,
        bestMove: { from: 'g8', to: 'a2', uci: 'g8a2' },
      },
    ];

    // Use a clearer synthetic fen where trade vs non-trade is obvious
    const tradeFen = '8/8/8/8/8/8/1q6/QK1k4 w - - 0 1';
    const tradeLines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 100, draw: 800, loss: 100 },
        depth: 16,
        bestMove: { from: 'a1', to: 'b2', uci: 'a1b2' }, // captures queen → K vs K
      },
      {
        multipv: 2,
        scoreCp: -10,
        mateIn: null,
        wdl: { win: 80, draw: 820, loss: 100 },
        depth: 16,
        bestMove: { from: 'a1', to: 'a2', uci: 'a1a2' }, // keeps queens
      },
    ];
    const pick = pickPracticalPressureMove(tradeFen, tradeLines, {
      maxCpGapFromBest: 30,
    });
    assert.ok(pick);
    assert.equal(pick!.move.uci, 'a1a2');
    assert.ok(pick!.reasons.includes('avoids-last-piece-trade') || pick!.reasons.includes('avoids-immediate-end'));
  });

  it('refuses a clearly inferior move beyond tolerance', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const lines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 100, draw: 800, loss: 100 },
        depth: 12,
        bestMove: { from: 'e3', to: 'e4', uci: 'e3e4' },
      },
      {
        multipv: 2,
        scoreCp: -200,
        mateIn: null,
        wdl: { win: 10, draw: 100, loss: 890 },
        depth: 12,
        bestMove: { from: 'e3', to: 'd3', uci: 'e3d3' },
      },
    ];
    const pick = pickPracticalPressureMove(fen, lines, { maxCpGapFromBest: 30 });
    assert.ok(pick);
    assert.equal(pick!.move.uci, 'e3e4');
  });

  it('refuses a self-mate line', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const lines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: -900000,
        mateIn: -1,
        wdl: null,
        depth: 12,
        bestMove: { from: 'e3', to: 'e2', uci: 'e3e2' },
      },
      {
        multipv: 2,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 100, draw: 800, loss: 100 },
        depth: 12,
        bestMove: { from: 'e3', to: 'd3', uci: 'e3d3' },
      },
    ];
    const pick = pickPracticalPressureMove(fen, lines);
    assert.ok(pick);
    assert.equal(pick!.move.uci, 'e3d3');
  });

  it('selects the only acceptable move', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const lines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 100, draw: 800, loss: 100 },
        depth: 12,
        bestMove: { from: 'e3', to: 'e4', uci: 'e3e4' },
      },
    ];
    const pick = pickPracticalPressureMove(fen, lines);
    assert.ok(pick);
    assert.equal(pick!.move.uci, 'e3e4');
  });

  it('falls back to bestMove when MultiPV unavailable', () => {
    const analysis = {
      scoreCp: 0,
      mateIn: null,
      depth: 12,
      wdl: { win: 100, draw: 800, loss: 100 },
      bestMove: { from: 'e3', to: 'e4', uci: 'e3e4' },
      lines: undefined,
    };
    const move = chooseOpponentMove(
      '8/8/8/4k3/8/4K3/8/8 w - - 0 1',
      analysis,
      'practical-pressure',
    );
    assert.equal(move?.uci, 'e3e4');
  });

  it('strict-best always returns analysis.bestMove', () => {
    const analysis = {
      scoreCp: 0,
      mateIn: null,
      depth: 12,
      wdl: null,
      bestMove: { from: 'a1', to: 'b2', uci: 'a1b2' },
      lines: [
        {
          multipv: 1,
          scoreCp: 0,
          mateIn: null,
          wdl: null,
          depth: 12,
          bestMove: { from: 'a1', to: 'b2', uci: 'a1b2' },
        },
        {
          multipv: 2,
          scoreCp: 0,
          mateIn: null,
          wdl: null,
          depth: 12,
          bestMove: { from: 'a1', to: 'a2', uci: 'a1a2' },
        },
      ],
    };
    const move = chooseOpponentMove(
      '8/8/8/8/8/8/1q6/QK1k4 w - - 0 1',
      analysis,
      'strict-best',
    );
    assert.equal(move?.uci, 'a1b2');
  });
});

describe('pool quality after reclassification', () => {
  it('has no bare heavy symmetry positions', () => {
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(
        isBareHeavySymmetry(p.fen),
        false,
        `${p.id} should not be bare heavy symmetry`,
      );
    }
  });

  it('defaults objective to DRAW and exposes training metadata', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 20);
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length < 117);
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(p.objective ?? 'DRAW', 'DRAW');
      assert.ok(p.family);
      assert.ok(p.trainingStyle);
    }
  });

  it('DEBUG ENDGAME is not shown in the screen', () => {
    const screen = read('app/puzzles/defends-nulle.tsx');
    assert.doesNotMatch(screen, /DEBUG ENDGAME/);
  });
});

describe('inferTrainingStyle', () => {
  it('marks opposition concepts as technical', () => {
    assert.equal(
      inferTrainingStyle({
        family: 'pawn',
        concepts: ['opposition', 'king-activity'],
      }),
      'technical',
    );
  });
});
