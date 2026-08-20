/**
 * Domain tests — evaluation, counter, −2 threshold, first major error.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  normalizeForDefender,
  formatPlayerEval,
  gaugeFillRatio,
  sideToMoveFromFen,
} from '../EvaluationNormalizer.ts';
import {
  createCounterState,
  registerSafePlayerMove,
  registerConfirmedLoss,
  registerOfficialDraw,
  markAbandoned,
  enterOffScore,
  crossesLossThreshold,
  findFirstMajorTurn,
  progressiveDeteriorationMessage,
} from '../AttemptScoring.ts';
import { ENDGAME_TRAINING_CONFIG, type EvaluationPoint } from '../types.ts';
import { verifyLoss } from '../../engine/LossVerifier.ts';
import {
  filterSafeCandidates,
  pickPracticalPressureMove,
  chooseOpponentMove,
} from '../../engine/PracticalPressurePolicy.ts';
import type { EngineAnalysisLine } from '../../../engines/analysis/types.ts';

describe('normalizeForDefender', () => {
  it('keeps score when player is white and white to move', () => {
    const n = normalizeForDefender(
      { scoreCp: -68, mateIn: null, sideToMove: 'w' },
      'white',
    );
    assert.equal(n.scoreCp, -68);
  });

  it('inverts when player is white and black to move', () => {
    const n = normalizeForDefender(
      { scoreCp: 120, mateIn: null, sideToMove: 'b' },
      'white',
    );
    assert.equal(n.scoreCp, -120);
  });

  it('keeps score when player is black and black to move', () => {
    const n = normalizeForDefender(
      { scoreCp: -50, mateIn: null, sideToMove: 'b' },
      'black',
    );
    assert.equal(n.scoreCp, -50);
  });

  it('inverts mate against black defender when white to move', () => {
    // STM white mates in 3 → for black defender this is mate against them
    const n = normalizeForDefender(
      { scoreCp: 999997, mateIn: 3, sideToMove: 'w' },
      'black',
    );
    assert.equal(n.mateIn, -3);
    assert.ok(n.scoreCp < 0);
  });

  it('formats eval and preserves numeric under gauge clamp', () => {
    assert.equal(formatPlayerEval(-191, null), '−1.91');
    assert.equal(formatPlayerEval(0, null), '0.00');
    const fill = gaugeFillRatio(-250); // below −2
    assert.equal(fill, 0);
    const fill0 = gaugeFillRatio(50); // above 0
    assert.equal(fill0, 1);
    const mid = gaugeFillRatio(-100);
    assert.ok(mid > 0.4 && mid < 0.6);
  });

  it('parses STM from FEN', () => {
    assert.equal(sideToMoveFromFen('8/8/8/8/8/8/8/8 b - - 0 1'), 'b');
  });
});

describe('attempt counter', () => {
  it('counts only safe player moves', () => {
    let s = createCounterState();
    for (let i = 0; i < 12; i++) s = registerSafePlayerMove(s);
    assert.equal(s.movesResisted, 12);
    assert.equal(s.outcome, 'in-progress');
  });

  it('losing move does not increment', () => {
    let s = createCounterState();
    for (let i = 0; i < 12; i++) s = registerSafePlayerMove(s);
    s = registerConfirmedLoss(s);
    assert.equal(s.movesResisted, 12);
    assert.equal(s.outcome, 'loss');
  });

  it('wins exactly at 30th safe move', () => {
    let s = createCounterState();
    for (let i = 0; i < 29; i++) s = registerSafePlayerMove(s);
    assert.equal(s.outcome, 'in-progress');
    s = registerSafePlayerMove(s);
    assert.equal(s.movesResisted, 30);
    assert.equal(s.outcome, 'win-30-moves');
    assert.equal(s.scoreLocked, true);
  });

  it('off-score continuation does not change result', () => {
    let s = createCounterState();
    for (let i = 0; i < 30; i++) s = registerSafePlayerMove(s);
    s = enterOffScore(s);
    const before = s.movesResisted;
    s = registerSafePlayerMove(s);
    assert.equal(s.movesResisted, before);
    assert.equal(s.outcome, 'win-30-moves');
  });

  it('official draw wins early', () => {
    let s = createCounterState();
    s = registerSafePlayerMove(s);
    s = registerOfficialDraw(s);
    assert.equal(s.outcome, 'win-official-draw');
    assert.equal(s.movesResisted, 1);
  });

  it('abandon is not a loss', () => {
    let s = createCounterState();
    s = registerSafePlayerMove(s);
    s = markAbandoned(s);
    assert.equal(s.outcome, 'abandoned');
  });
});

describe('loss threshold −2', () => {
  it('does not lose at −1.99', () => {
    assert.equal(crossesLossThreshold(-199), false);
  });

  it('does not lose at exactly −2.00', () => {
    assert.equal(crossesLossThreshold(-200), false);
  });

  it('crosses under −2', () => {
    assert.equal(crossesLossThreshold(-201), true);
  });

  it('rejects false crossing when confirmation recovers', () => {
    const v = verifyLoss(
      { scoreCp: -210, mateIn: null },
      { scoreCp: -150, mateIn: null },
    );
    assert.equal(v.lost, false);
    assert.equal(v.reason, 'recovered');
  });

  it('confirms loss when confirmation stays under −2', () => {
    const v = verifyLoss(
      { scoreCp: -210, mateIn: null },
      { scoreCp: -230, mateIn: null },
    );
    assert.equal(v.lost, true);
  });

  it('mate against player is immediate loss', () => {
    const v = verifyLoss({ scoreCp: -999000, mateIn: -2 }, null);
    assert.equal(v.lost, true);
    assert.equal(v.reason, 'mate');
  });
});

describe('first major turn', () => {
  function pt(n: number, cp: number, san?: string): EvaluationPoint {
    return {
      afterPlayerMove: n,
      playerMoveNumber: n,
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      scoreCp: cp,
      mateIn: null,
      san,
    };
  }

  it('detects first drop of ≥ 1 pawn', () => {
    const tl = [pt(0, 0), pt(1, -20, 'Ke2'), pt(2, -150, 'Rd2')];
    // delta from -20 to -150 = -130 ≤ -100
    const t = findFirstMajorTurn(tl);
    assert.ok(t);
    assert.equal(t!.san, 'Rd2');
    assert.equal(t!.playerMoveNumber, 2);
  });

  it('picks the first significant drop among several', () => {
    const tl = [
      pt(0, 0),
      pt(1, -110, 'a4'),
      pt(2, -250, 'Rd2'),
    ];
    const t = findFirstMajorTurn(tl);
    assert.equal(t!.san, 'a4');
  });

  it('returns null for progressive drip', () => {
    const tl = [pt(0, 0), pt(1, -40), pt(2, -80), pt(3, -120), pt(4, -160)];
    assert.equal(findFirstMajorTurn(tl), null);
    assert.match(progressiveDeteriorationMessage(), /Aucune grosse erreur/);
  });
});

describe('practical-pressure policy', () => {
  it('never picks a move beyond the safety window', () => {
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
        wdl: { win: 10, draw: 50, loss: 940 },
        depth: 12,
        bestMove: { from: 'e3', to: 'd2', uci: 'e3d2' },
      },
    ];
    const safe = filterSafeCandidates(lines, 40);
    assert.equal(safe.length, 1);
    assert.equal(safe[0]!.bestMove?.uci, 'e3e4');
  });

  it('prefers non-liquidating safe move when available', () => {
    const fen = '8/8/8/8/8/8/1q6/QK1k4 w - - 0 1';
    const lines: EngineAnalysisLine[] = [
      {
        multipv: 1,
        scoreCp: 0,
        mateIn: null,
        wdl: { win: 50, draw: 900, loss: 50 },
        depth: 14,
        bestMove: { from: 'a1', to: 'b2', uci: 'a1b2' },
      },
      {
        multipv: 2,
        scoreCp: -5,
        mateIn: null,
        wdl: { win: 60, draw: 880, loss: 60 },
        depth: 14,
        bestMove: { from: 'a1', to: 'a2', uci: 'a1a2' },
      },
    ];
    const pick = pickPracticalPressureMove(fen, lines);
    assert.ok(pick);
    assert.equal(pick!.move.uci, 'a1a2');
  });

  it('falls back to best when MultiPV missing', () => {
    const m = chooseOpponentMove('8/8/8/8/8/8/8/4K2k w - - 0 1', {
      bestMove: { from: 'e1', to: 'e2', uci: 'e1e2' },
      lines: undefined,
    });
    assert.equal(m?.uci, 'e1e2');
  });

  it('config target is 30', () => {
    assert.equal(ENDGAME_TRAINING_CONFIG.targetPlayerMoves, 30);
    assert.equal(ENDGAME_TRAINING_CONFIG.lossThresholdCp, -200);
  });
});
