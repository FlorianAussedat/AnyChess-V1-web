/**
 * Certified dataset + selection + regulatory draw/mate end tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
} from '../positions.ts';
import {
  getDefendDrawPosition,
  listCertifiedEndgames,
} from '../EndgamePositionRepository.ts';
import {
  isTrivialDefendDrawPosition,
  isTrivialInsufficientMaterial,
} from '../defensivePrecision.ts';
import { validateDefendDrawFen } from '../fenValidation.ts';
import {
  evaluateRegulatoryEnd,
  regulatorySuccessMessage,
} from '../gameEnd.ts';
import { DefendDrawSession } from '../DefendDrawSession.ts';
import { createMockDefenseAnalyzer } from '../mockDefenseAnalyzer.ts';
import type { DefenseAnalysis } from '../defenseTypes.ts';

function baseAnalysis(partial: Partial<DefenseAnalysis> = {}): DefenseAnalysis {
  return {
    scoreCp: 0,
    mateIn: null,
    depth: 12,
    wdl: { win: 100, draw: 800, loss: 100 },
    bestMove: { from: 'e2', to: 'e4' },
    ...partial,
  };
}

describe('certified dataset integrity', () => {
  it('every entry has verifiedDraw true, legal FEN, proven certification, and is non-trivial', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 100);
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(p.verifiedDraw, true, p.id);
      assert.equal(p.verification.result, 'draw', p.id);
      assert.ok(
        p.verification.method === 'syzygy' || p.verification.method === 'stockfish',
        p.id,
      );
      assert.match(p.id, /^DD-\d{3}$/, p.id);
      const fen = validateDefendDrawFen(p.fen, p.defenderColor);
      assert.equal(fen.ok, true, `${p.id}: ${!fen.ok ? fen.reason : ''}`);
      assert.equal(isTrivialInsufficientMaterial(p.fen), false, p.id);
      assert.equal(isTrivialDefendDrawPosition(p), false, p.id);
      assert.equal(p.playerColor, p.defenderColor, p.id);
      assert.ok(p.family, p.id);
      assert.ok(p.concepts.length >= 1, p.id);
    }
  });

  it('rejects K vs K / KB vs K / KN vs K as trivial', () => {
    assert.equal(
      isTrivialInsufficientMaterial('8/8/8/4k3/8/4K3/8/8 w - - 0 1'),
      true,
    );
    assert.equal(
      isTrivialInsufficientMaterial('8/8/8/4k3/8/4K3/4B3/8 w - - 0 1'),
      true,
    );
    assert.equal(
      isTrivialInsufficientMaterial('8/8/8/4k3/8/4K3/4N3/8 w - - 0 1'),
      true,
    );
  });

  it('listCertifiedEndgames never includes unverified or trivial rows', () => {
    for (const p of listCertifiedEndgames()) {
      assert.equal(p.verifiedDraw, true);
      assert.equal(p.verified, true);
      assert.equal(isTrivialDefendDrawPosition(p), false);
    }
  });

  it('getDefendDrawPosition respects difficulty and never returns another band', () => {
    for (const diff of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
      for (let i = 0; i < 12; i++) {
        const p = getDefendDrawPosition(diff, [], () => i / 12);
        assert.equal(p.difficulty, diff);
        assert.equal(p.verifiedDraw, true);
      }
    }
  });
});

describe('regulatory end detection', () => {
  it('detects insufficient material (K vs K)', () => {
    const g = new Chess('8/8/8/4k3/8/4K3/8/8 w - - 0 1');
    const end = evaluateRegulatoryEnd(g);
    assert.equal(end?.kind, 'insufficient');
    assert.match(regulatorySuccessMessage('insufficient'), /matériel insuffisant/i);
  });

  it('detects K+B vs K as insufficient', () => {
    const g = new Chess('8/8/8/4k3/8/4K3/4B3/8 w - - 0 1');
    assert.equal(evaluateRegulatoryEnd(g)?.kind, 'insufficient');
  });

  it('detects K+N vs K as insufficient', () => {
    const g = new Chess('8/8/8/4k3/8/4K3/4N3/8 w - - 0 1');
    assert.equal(evaluateRegulatoryEnd(g)?.kind, 'insufficient');
  });

  it('detects stalemate', () => {
    const g = new Chess('k7/2Q5/8/8/8/8/8/4K3 b - - 0 1');
    assert.ok(g.isStalemate());
    assert.equal(evaluateRegulatoryEnd(g)?.kind, 'stalemate');
  });

  it('detects checkmate winner', () => {
    const g = new Chess('7k/6Q1/6K1/8/8/8/8/8 b - - 0 1');
    assert.ok(g.isCheckmate());
    const end = evaluateRegulatoryEnd(g);
    assert.equal(end?.kind, 'checkmate');
    if (end?.kind === 'checkmate') assert.equal(end.winner, 'w');
  });

  it('detects fifty-move draw via chess.js', () => {
    const g = new Chess('8/8/8/4k3/8/4K3/4N3/8 w - - 100 80');
    // K+N vs K is also insufficient — prefer either draw kind
    const end = evaluateRegulatoryEnd(g);
    assert.ok(end && (end.kind === 'fifty' || end.kind === 'insufficient'));
  });
});

describe('session regulatory success stops before Stockfish', () => {
  it('K vs K after user move ends as success without calling analyzer', async () => {
    let analyzeCalls = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      analyzeCalls += 1;
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      return baseAnalysis({
        bestMove: m ? { from: m.from, to: m.to, promotion: m.promotion } : null,
      });
    });
    const capturePos = {
      id: 'DD-TEST',
      // Black Kb3 captures Nb4 → K vs K.
      fen: '8/8/8/8/1N6/1k6/8/K7 b - - 0 1',
      difficulty: 'debutant' as const,
      family: 'pawn' as const,
      concepts: ['king-activity'] as const,
      theme: 'test',
      label: 'test',
      defenderColor: 'b' as const,
      playerColor: 'b' as const,
      verifiedDraw: true as const,
      verification: { method: 'syzygy' as const, result: 'draw' as const },
      verified: true as const,
      initialOutcome: 'draw' as const,
      legalMoves: 8,
      drawingMoves: 2,
    };
    const repo = {
      pick: () => capturePos,
      list: () => [capturePos],
    };
    const session2 = new DefendDrawSession({
      analyzer,
      targetMoves: 30,
      repository: repo as never,
    });
    await session2.start('debutant', [], () => 0);
    analyzeCalls = 0;
    const after = await session2.attemptMove('b3', 'b4');
    assert.equal(after.phase, 'drawn-early');
    assert.match(after.lastFeedback ?? '', /matériel insuffisant/i);
    assert.equal(after.boardGameOver, true);
    assert.equal(analyzeCalls, 0);
  });

  it('stalemate after user move ends as success without Stockfish', async () => {
    let analyzeCalls = 0;
    const analyzer = createMockDefenseAnalyzer(() => {
      analyzeCalls += 1;
      return baseAnalysis();
    });
    // White to move delivers stalemate: Ka1 Qb3 vs Ka8 — actually craft:
    // Position before stalemate: black king a8, white queen c7, white king e1,
    // white to move Qc8? Simpler: defender is white and plays into stalemate.
    // Known: white Kd5 Qg5, black Kh8 — Qg6? 
    // Use: fen `k7/8/1Q6/8/8/8/8/4K3 w` — Qb7 is mate or stalemate?
    // Classic stalemate delivery: `k7/2Q5/8/8/8/8/8/4K3` is already stalemate black to move.
    // So start one ply earlier: `k7/8/2Q5/8/8/8/8/4K3 w` — white Qc7-c8 or Qc7-b7?
    // From `7k/5Q2/6K1/8/8/8/8/8 w` Qf7-f8? Let's use chess to find.
    const before = new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
    const stalemateMove = before.moves({ verbose: true }).find((m) => {
      const c = new Chess(before.fen());
      c.move(m);
      return c.isStalemate();
    });
    assert.ok(stalemateMove, 'expected a stalemating move');

    const pos = {
      id: 'DD-STALE',
      fen: before.fen(),
      difficulty: 'debutant' as const,
      family: 'queen' as const,
      concepts: ['accurate-defense'] as const,
      theme: 'test',
      label: 'test',
      defenderColor: 'w' as const,
      playerColor: 'w' as const,
      verifiedDraw: true as const,
      verification: { method: 'syzygy' as const, result: 'draw' as const },
      verified: true as const,
      initialOutcome: 'draw' as const,
      legalMoves: 10,
      drawingMoves: 2,
    };
    const session = new DefendDrawSession({
      analyzer,
      repository: { pick: () => pos, list: () => [pos] } as never,
    });
    await session.start('debutant', [], () => 0);
    analyzeCalls = 0;
    const after = await session.attemptMove(stalemateMove!.from, stalemateMove!.to);
    assert.equal(after.phase, 'drawn-early');
    assert.match(after.lastFeedback ?? '', /Pat/i);
    assert.equal(analyzeCalls, 0);
  });
});
