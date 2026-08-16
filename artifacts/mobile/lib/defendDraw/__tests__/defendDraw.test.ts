/**
 * Défends la nulle — certified starts + Stockfish-only mid-game logic.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import {
  CLEARLY_LOST_CP_MAX,
  CLEARLY_LOST_STREAK_REQUIRED,
  CLEARLY_LOST_WDL_LOSS_MIN,
  DEFEND_DRAW_POSITIONS,
  DEFEND_DRAW_TARGET_MOVES,
  DefendDrawSession,
  createMockDefenseAnalyzer,
  endgamePositionRepository,
  evaluateClearlyLostSignal,
  isClearlyLostPosition,
  isTrivialInsufficientMaterial,
  listCertifiedEndgames,
  pickCertifiedEndgame,
  verdictFromCp,
  type DefenseAnalysis,
} from '../index.ts';
import { parseInfoScoreSnapshot } from '../../engines/stockfish/uci.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

function baseAnalysis(partial: Partial<DefenseAnalysis> = {}): DefenseAnalysis {
  return {
    scoreCp: 0,
    mateIn: null,
    depth: 12,
    wdl: { win: 100, draw: 800, loss: 100 },
    bestMove: { from: 'e1', to: 'e2' },
    ...partial,
  };
}

describe('constants', () => {
  it('targets 30 player moves and keeps conservative loss thresholds', () => {
    assert.equal(DEFEND_DRAW_TARGET_MOVES, 30);
    assert.ok(CLEARLY_LOST_CP_MAX <= -600);
    assert.ok(CLEARLY_LOST_WDL_LOSS_MIN >= 850);
    assert.equal(CLEARLY_LOST_STREAK_REQUIRED, 2);
  });
});

describe('parseInfoScoreSnapshot', () => {
  it('parses cp, mate and optional wdl', () => {
    const cp = parseInfoScoreSnapshot(
      'info depth 14 score cp -42 wdl 20 100 880 pv e2e4',
    );
    assert.ok(cp);
    assert.equal(cp!.scoreCp, -42);
    assert.equal(cp!.mateIn, null);
    assert.deepEqual(cp!.wdl, { win: 20, draw: 100, loss: 880 });
    assert.equal(cp!.pvMove, 'e2e4');

    const mate = parseInfoScoreSnapshot('info depth 10 score mate -3 pv a1a2');
    assert.ok(mate);
    assert.equal(mate!.mateIn, -3);
  });
});

describe('isClearlyLostPosition', () => {
  it('does not treat a mild negative eval as lost', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const mild = evaluateClearlyLostSignal(
      baseAnalysis({ scoreCp: -120, wdl: null, depth: 14 }),
      fen,
      'w',
    );
    assert.equal(mild.lost, false);
  });

  it('detects forced mate against the defender immediately', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    // White to move, mate against white (negative mateIn)
    const r = isClearlyLostPosition(
      baseAnalysis({ mateIn: -2, scoreCp: -999000, wdl: null }),
      fen,
      'w',
      0,
    );
    assert.equal(r.clearlyLost, true);
    assert.equal(r.verdict.reason, 'mate');
  });

  it('requires a streak for non-mate clear losses', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const analysis = baseAnalysis({
      scoreCp: -800,
      wdl: { win: 10, draw: 20, loss: 970 },
      depth: 14,
    });
    const first = isClearlyLostPosition(analysis, fen, 'w', 0);
    assert.equal(first.clearlyLost, false);
    assert.equal(first.nextStreak, 1);
    const second = isClearlyLostPosition(analysis, fen, 'w', first.nextStreak);
    assert.equal(second.clearlyLost, true);
    assert.equal(second.verdict.reason, 'wdl');
  });
});

describe('EndgamePositionRepository', () => {
  it('only exposes certified non-trivial draws', () => {
    const all = listCertifiedEndgames();
    assert.ok(all.length >= 8);
    for (const p of all) {
      assert.equal(p.initialOutcome, 'draw');
      assert.equal(p.verified, true);
      assert.equal(isTrivialInsufficientMaterial(p.fen), false);
      assert.ok(p.drawingMoves >= 1);
    }
    assert.equal(
      DEFEND_DRAW_POSITIONS.some((p) =>
        isTrivialInsufficientMaterial(p.fen),
      ),
      false,
    );
  });

  it('picks per difficulty without immediate repeats when possible', () => {
    const a = pickCertifiedEndgame('expert', [], () => 0);
    const b = endgamePositionRepository.pick('expert', [a.id], () => 0.1);
    assert.equal(a.difficulty, 'expert');
    assert.equal(b.difficulty, 'expert');
    if (endgamePositionRepository.list('expert').length > 1) {
      assert.notEqual(b.id, a.id);
    }
  });
});

describe('DefendDrawSession with mock Stockfish', () => {
  it('starts from a certified draw and counts only player moves', async () => {
    const analyzer = createMockDefenseAnalyzer((fen) => {
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      return baseAnalysis({
        bestMove: m
          ? { from: m.from, to: m.to, promotion: m.promotion }
          : null,
        scoreCp: 0,
        wdl: { win: 100, draw: 800, loss: 100 },
      });
    });
    const session = new DefendDrawSession({
      analyzer,
      targetMoves: 30,
    });
    const snap = await session.start('debutant', [], () => 0);
    assert.equal(snap.playerMovesMade, 0);
    assert.equal(snap.targetMoves, 30);
    assert.equal(snap.position?.initialOutcome, 'draw');
    assert.equal(snap.phase, 'playing');
  });

  it('wins at target without treating mild eval as loss', async () => {
    const analyzer = createMockDefenseAnalyzer((fen) => {
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      return baseAnalysis({
        bestMove: m
          ? { from: m.from, to: m.to, promotion: m.promotion }
          : null,
        scoreCp: -150,
        wdl: { win: 200, draw: 600, loss: 200 },
        depth: 14,
      });
    });
    const session = new DefendDrawSession({ analyzer, targetMoves: 1 });
    await session.start('debutant', [], () => 0);
    const legal = session.getChess().moves({ verbose: true })[0]!;
    const after = await session.attemptMove(legal.from, legal.to);
    assert.equal(after.playerMovesMade, 1);
    assert.equal(after.phase, 'won');
    assert.match(after.lastFeedback ?? '', /Nulle défendue pendant/);
  });

  it('marks loss with Stockfish wording (not tablebase perfect play)', async () => {
    let calls = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      calls += 1;
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      return baseAnalysis({
        bestMove: m
          ? { from: m.from, to: m.to, promotion: m.promotion }
          : null,
        mateIn: g.turn() === 'w' ? -1 : 1,
        scoreCp: -900000,
        wdl: null,
        depth: 16,
      });
    });
    const session = new DefendDrawSession({ analyzer, targetMoves: 30 });
    const start = await session.start('debutant', [], () => 0);
    const legal = session.getChess().moves({ verbose: true })[0]!;
    const after = await session.attemptMove(legal.from, legal.to);
    assert.equal(after.phase, 'lost');
    assert.match(
      after.lastFeedback ?? '',
      /perdante|Mat forcé|suite forcée/i,
    );
    assert.doesNotMatch(
      after.lastFeedback ?? '',
      /jeu parfait de l’adversaire/,
    );
    assert.ok(calls >= 1);
    assert.equal(start.position?.verified, true);
  });

  it('session source no longer probes tablebase mid-game', () => {
    const src = read('lib/defendDraw/DefendDrawSession.ts');
    assert.doesNotMatch(src, /probeWdl/);
    assert.doesNotMatch(src, /WdlProbe/);
    assert.doesNotMatch(src, /opponentMove/);
    assert.match(src, /isClearlyLostPosition/);
    assert.match(src, /analyzer\.analyze/);
  });
});

describe('navigation still under Entraînement tactique', () => {
  it('uses StockfishAnalysisService on the screen', () => {
    const screen = read('app/puzzles/defends-nulle.tsx');
    assert.match(screen, /StockfishAnalysisService/);
    assert.doesNotMatch(screen, /RandomEngine/);
    assert.doesNotMatch(screen, /probeWdl/);
    const hub = read('components/puzzles/PuzzleHubPhase.tsx');
    assert.match(hub, /puzzle-card-defends-nulle/);
    const culture = read('app/quiz-ouverture/index.tsx');
    assert.doesNotMatch(culture, /defends-nulle/);
  });
});

describe('wdl cp helper still works', () => {
  it('maps centipawns coarsely', () => {
    assert.equal(verdictFromCp(200), 'win');
    assert.equal(verdictFromCp(-200), 'loss');
  });
});
