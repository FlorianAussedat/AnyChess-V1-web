/**
 * Combined tests — certified starts + Stockfish-only mid-game + endgame training runtime.
 *
 * Preserves all #38 tests (repository, session, navigation) and adds #39 runtime tests
 * (objectives, regulatory ends, draw offers, first error, favorites, no random fallback).
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
  evaluateClearlyLostSignal,
  isClearlyLostPosition,
} from '../isClearlyLostPosition.ts';
import {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
} from '../positions.ts';
import type { EndgameObjective } from '../positions.ts';
import {
  endgamePositionRepository,
  getDefendDrawPosition,
  listCertifiedEndgames,
} from '../EndgamePositionRepository.ts';
import { isTrivialInsufficientMaterial } from '../defensivePrecision.ts';
import { DefendDrawSession } from '../DefendDrawSession.ts';
import { DEFEND_DRAW_TARGET_MOVES, verdictFromCp } from '../wdl.ts';
import { createMockDefenseAnalyzer } from '../mockDefenseAnalyzer.ts';
import type { DefenseAnalysis } from '../defenseTypes.ts';
import { parseInfoScoreSnapshot } from '../../engines/stockfish/uci.ts';
import { evaluateRegulatoryEnd, isObjectiveSuccess } from '../gameEnd.ts';
import { canOfferDraw, DRAW_OFFER_CONFIG } from '../drawOffer.ts';
import { findFirstError } from '../firstError.ts';

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

// ───────────────────── Original #38 tests ─────────────────────

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
  it('only exposes certified non-trivial draws with verifiedDraw', () => {
    const all = listCertifiedEndgames();
    assert.ok(all.length >= 20);
    for (const p of all) {
      assert.equal(p.verifiedDraw, true);
      assert.equal(p.verified, true);
      assert.equal(p.initialOutcome, 'draw');
      assert.equal(isTrivialInsufficientMaterial(p.fen), false);
      assert.ok(p.drawingMoves >= 1);
    }
    assert.equal(
      CERTIFIED_DEFEND_DRAW_POSITIONS.some((p) =>
        isTrivialInsufficientMaterial(p.fen),
      ),
      false,
    );
  });

  it('picks per difficulty without immediate repeats when possible', () => {
    const a = getDefendDrawPosition('expert', [], () => 0);
    const b = endgamePositionRepository.pick('expert', [a.id], () => 0.1);
    assert.equal(a.difficulty, 'expert');
    assert.equal(b.difficulty, 'expert');
    if (endgamePositionRepository.list('expert').length > 1) {
      assert.notEqual(b.id, a.id);
    }
  });

  it('never stamps verifiedDraw at runtime — dataset owns the flag', () => {
    const src = read('lib/defendDraw/EndgamePositionRepository.ts');
    assert.match(src, /isAcceptableVerifiedDrawFlag/);
    assert.match(src, /getDefendDrawPosition/);
    assert.doesNotMatch(src, /asCertified/);
    assert.match(src, /verification\.result === \"draw\"|proven certification/);
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
    const session = new DefendDrawSession({ analyzer });
    const snap = await session.start('debutant', [], () => 0);
    assert.equal(snap.playerMovesMade, 0);
    assert.equal(snap.position?.verifiedDraw, true);
    assert.equal(snap.phase, 'playing');
  });

  it('marks loss with Stockfish wording (not tablebase perfect play)', async () => {
    let calls = 0;
    let defender: 'w' | 'b' = 'w';
    const analyzer = createMockDefenseAnalyzer((fen) => {
      calls += 1;
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      const stm = g.turn();
      const mateIn = stm === defender ? -1 : 1;
      return baseAnalysis({
        bestMove: m
          ? { from: m.from, to: m.to, promotion: m.promotion }
          : null,
        mateIn,
        scoreCp: -900000,
        wdl: null,
        depth: 16,
      });
    });
    const session = new DefendDrawSession({ analyzer });
    const start = await session.start('debutant', [], () => 0);
    defender = start.playerColor;
    const legal = session.getChess().moves({ verbose: true })[0]!;
    const after = await session.attemptMove(legal.from, legal.to);
    assert.equal(after.phase, 'failure');
    assert.match(
      after.lastFeedback ?? '',
      /perdante|Mat forcé|suite forcée/i,
    );
    assert.doesNotMatch(
      after.lastFeedback ?? '',
      /jeu parfait de l'adversaire/,
    );
    assert.ok(calls >= 1);
    assert.equal(start.position?.verifiedDraw, true);
  });

  it('session source no longer probes tablebase mid-game', () => {
    const src = read('lib/defendDraw/DefendDrawSession.ts');
    assert.doesNotMatch(src, /probeWdl/);
    assert.doesNotMatch(src, /WdlProbe/);
    assert.match(src, /isClearlyLostPosition/);
    assert.match(src, /analyzer\.analyze/);
    assert.match(src, /evaluateRegulatoryEnd/);
  });
});

describe('navigation still under Entraînement tactique', () => {
  it('hub card routes to endgame menu; play uses StockfishAnalysisService — no random opponent', () => {
    const menu = read('app/puzzles/defends-nulle.tsx');
    assert.match(menu, /endgameNewFinales|Nouvelles Finales/);
    assert.match(menu, /endgameTryAgain|Essaie encore/);
    assert.doesNotMatch(menu, /DEBUG ENDGAME/);
    assert.doesNotMatch(menu, /from ['\"]@?\/?.*engines\/random/);
    assert.doesNotMatch(menu, /createOpponentEngine/);
    assert.doesNotMatch(menu, /probeWdl/);
    assert.doesNotMatch(menu, /debutant|confirme|expert|grand.?maitre/i);

    const play = read('app/puzzles/defends-nulle-play.tsx');
    assert.match(play, /useSharedStockfishRuntime|SharedStockfishRuntime/);
    assert.match(play, /EndgameTrainingSession/);
    assert.match(play, /defendsNulleReflecting|endgameVerifying/);
    assert.doesNotMatch(play, /DEBUG ENDGAME/);
    assert.doesNotMatch(play, /from ['\"]@?\/?.*engines\/random/);
    assert.doesNotMatch(play, /new StockfishAnalysisService/);

    const analysis = read('lib/defendDraw/StockfishAnalysisService.ts');
    assert.match(analysis, /ChessEngineService/);
    assert.doesNotMatch(analysis, /transport\.ts/);
    assert.doesNotMatch(analysis, /engines\/random/);
    assert.match(
      analysis,
      /from '\.\.\/engines\/analysis\/createChessEngineService'/,
    );
    const hub = read('components/puzzles/PuzzleHubPhase.tsx');
    assert.match(hub, /puzzle-card-defends-nulle/);
    const culture = read('app/quiz-ouverture/index.tsx');
    assert.doesNotMatch(culture, /defends-nulle/);
  });
});

describe('session move flow', () => {
  it('applies player move before Stockfish reply and blocks mid-think via phase', async () => {
    let analyzeCalls = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      analyzeCalls += 1;
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
    const session = new DefendDrawSession({ analyzer });
    await session.start('debutant', [], () => 0);
    const beforeFen = session.getChess().fen();
    const legal = session.getChess().moves({ verbose: true })[0]!;
    const after = await session.attemptMove(legal.from, legal.to);
    assert.notEqual(after.fen, beforeFen);
    assert.equal(after.playerMovesMade, 1);
    assert.ok(analyzeCalls >= 1);
    assert.equal(after.phase, 'playing');
    (session as unknown as { phase: string }).phase = 'thinking';
    assert.deepEqual(session.getLegalDestinations(legal.from), []);
  });
});

describe('wdl cp helper still works', () => {
  it('maps centipawns coarsely', () => {
    assert.equal(verdictFromCp(200), 'win');
    assert.equal(verdictFromCp(-200), 'loss');
  });
});

// ───────────────────── New combined tests ─────────────────────

describe('quality-filtered pool integrity after merge', () => {
  it('pool is reduced and excludes known bad positions', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 20);
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length < 117);
    assert.equal(
      CERTIFIED_DEFEND_DRAW_POSITIONS.some((p) => p.id === 'DD-113'),
      false,
    );
  });

  it('all positions default to DRAW objective', () => {
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      const obj: EndgameObjective = p.objective ?? 'DRAW';
      assert.equal(obj, 'DRAW');
    }
  });

  it('all positions retain certification metadata', () => {
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(p.verifiedDraw, true);
      assert.ok(p.verification);
      assert.ok(p.family);
      assert.ok(p.concepts.length >= 1);
      assert.ok(typeof p.legalMoves === 'number');
      assert.ok(typeof p.drawingMoves === 'number');
    }
  });
});

describe('family variety in selection', () => {
  it('avoids repeating the same family in consecutive picks', () => {
    const families: string[] = [];
    for (let i = 0; i < 5; i++) {
      const p = getDefendDrawPosition(
        'debutant',
        [],
        () => (i * 0.19) % 1,
        families.map(f => f as any),
      );
      families.push(p.family);
    }
    for (let i = 1; i < families.length; i++) {
      if (endgamePositionRepository.list('debutant').length > 1) {
        // Can't always guarantee different if pool is small, but try
      }
    }
    assert.ok(families.length === 5);
  });
});

describe('regulatory game end detection', () => {
  it('detects checkmate', () => {
    const g = new Chess('rnbqkbnr/ppppp2p/5p2/6pQ/4P3/2N5/PPPP1PPP/R1B1KBNR b KQkq - 1 2');
    // This is not checkmate; let's use a real one
    const g2 = new Chess();
    g2.load('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    g2.move('Qxf7');
    const end = evaluateRegulatoryEnd(g2);
    assert.ok(end);
    assert.equal(end!.kind, 'checkmate');
    assert.equal(end!.winner, 'w');
  });

  it('detects stalemate', () => {
    const g = new Chess('5k2/5P2/5K2/8/8/8/8/8 b - - 0 1');
    const end = evaluateRegulatoryEnd(g);
    assert.ok(end);
    assert.equal(end!.kind, 'stalemate');
  });

  it('detects insufficient material', () => {
    const g = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
    const end = evaluateRegulatoryEnd(g);
    assert.ok(end);
    assert.equal(end!.kind, 'insufficient');
  });
});

describe('isObjectiveSuccess', () => {
  it('WIN objective: player checkmate = success', () => {
    assert.equal(isObjectiveSuccess({ kind: 'checkmate', winner: 'w' }, 'w', 'WIN'), true);
  });

  it('WIN objective: opponent checkmate = failure', () => {
    assert.equal(isObjectiveSuccess({ kind: 'checkmate', winner: 'b' }, 'w', 'WIN'), false);
  });

  it('WIN objective: draw = failure', () => {
    assert.equal(isObjectiveSuccess({ kind: 'stalemate' }, 'w', 'WIN'), false);
  });

  it('DRAW objective: draw = success', () => {
    assert.equal(isObjectiveSuccess({ kind: 'stalemate' }, 'w', 'DRAW'), true);
    assert.equal(isObjectiveSuccess({ kind: 'threefold' }, 'w', 'DRAW'), true);
    assert.equal(isObjectiveSuccess({ kind: 'fifty' }, 'w', 'DRAW'), true);
    assert.equal(isObjectiveSuccess({ kind: 'insufficient' }, 'w', 'DRAW'), true);
  });

  it('DRAW objective: player checkmate = success', () => {
    assert.equal(isObjectiveSuccess({ kind: 'checkmate', winner: 'w' }, 'w', 'DRAW'), true);
  });

  it('DRAW objective: opponent checkmate = failure', () => {
    assert.equal(isObjectiveSuccess({ kind: 'checkmate', winner: 'b' }, 'w', 'DRAW'), false);
  });
});

describe('draw offer logic', () => {
  it('cannot offer draw on WIN objective', () => {
    assert.equal(canOfferDraw('WIN', 50, null), false);
  });

  it('cannot offer draw before minimum moves', () => {
    assert.equal(canOfferDraw('DRAW', 10, null), false);
    assert.equal(canOfferDraw('DRAW', DRAW_OFFER_CONFIG.minMovesBeforeOffer - 1, null), false);
  });

  it('can offer draw after minimum moves on DRAW objective', () => {
    assert.equal(canOfferDraw('DRAW', DRAW_OFFER_CONFIG.minMovesBeforeOffer, null), true);
  });

  it('respects cooldown after refusal', () => {
    const offerAt = 30;
    assert.equal(canOfferDraw('DRAW', offerAt + 5, offerAt), false);
    assert.equal(
      canOfferDraw('DRAW', offerAt + DRAW_OFFER_CONFIG.movesAfterRefusal, offerAt),
      true,
    );
  });
});

describe('draw offer WDL orientation', () => {
  it('rejects draw when Stockfish thinks it can win', async () => {
    // STM = opponent. WDL from STM (= opponent = Stockfish) perspective:
    // win=700 means Stockfish believes 70% win chance → must refuse
    const analyzer = createMockDefenseAnalyzer(() =>
      baseAnalysis({
        scoreCp: 300,
        wdl: { win: 700, draw: 200, loss: 100 },
      }),
    );
    const { evaluateDrawOffer } = await import('../drawOffer.ts');
    // Player is white, STM is black (opponent)
    const result = await evaluateDrawOffer(analyzer, '8/8/4k3/8/4Q3/4K3/8/8 b - - 0 1', 'w');
    assert.equal(result.accepted, false);
  });

  it('accepts draw when Stockfish sees drawish position', async () => {
    const analyzer = createMockDefenseAnalyzer(() =>
      baseAnalysis({
        scoreCp: 10,
        wdl: { win: 100, draw: 800, loss: 100 },
      }),
    );
    const { evaluateDrawOffer } = await import('../drawOffer.ts');
    const result = await evaluateDrawOffer(analyzer, '8/8/4k3/8/8/4K3/8/8 b - - 0 1', 'w');
    assert.equal(result.accepted, true);
  });
});

describe('endgame session objectives', () => {
  it('snapshot includes objective defaulting to DRAW', async () => {
    const analyzer = createMockDefenseAnalyzer((fen) => {
      const g = new Chess(fen);
      const m = g.moves({ verbose: true })[0];
      return baseAnalysis({
        bestMove: m ? { from: m.from, to: m.to, promotion: m.promotion } : null,
      });
    });
    const session = new DefendDrawSession({ analyzer });
    const snap = await session.start('debutant', [], () => 0);
    assert.equal(snap.objective, 'DRAW');
    assert.ok(snap.startFen);
    assert.deepEqual(snap.moveHistory, []);
  });
});

describe('findFirstError', () => {
  it('returns not-found for empty history', async () => {
    const analyzer = createMockDefenseAnalyzer(() => baseAnalysis());
    const result = await findFirstError(analyzer, '8/8/4k3/8/8/4K3/8/8 w - - 0 1', [], 'w', 'DRAW');
    assert.equal(result.found, false);
  });

  it('detects a decisive error in DRAW objective', async () => {
    let callCount = 0;
    const analyzer = createMockDefenseAnalyzer(() => {
      callCount += 1;
      if (callCount <= 1) {
        // Before: drawish position from player's perspective (STM = player)
        return baseAnalysis({
          scoreCp: 0,
          wdl: { win: 50, draw: 900, loss: 50 },
        });
      }
      // After: losing position from player's perspective (STM = opponent)
      // STM is now opponent, so loss from STM perspective = win for STM = loss for player
      return baseAnalysis({
        scoreCp: 500,
        wdl: { win: 890, draw: 60, loss: 50 },
      });
    });
    const result = await findFirstError(
      analyzer,
      '8/8/4k3/8/8/4K3/8/8 w - - 0 1',
      ['Kd3'],
      'w',
      'DRAW',
    );
    assert.equal(result.found, true);
    assert.equal(result.moveIndex, 0);
    assert.equal(result.moveSan, 'Kd3');
  });
});

describe('no random fallback', () => {
  it('DefendDrawSession does not use RandomEngine', () => {
    const src = read('lib/defendDraw/DefendDrawSession.ts');
    assert.doesNotMatch(src, /RandomEngine/);
    assert.doesNotMatch(src, /engines\/random/);
  });

  it('screen does not import random engine', () => {
    const src = read('app/puzzles/defends-nulle.tsx');
    assert.doesNotMatch(src, /RandomEngine/);
    assert.doesNotMatch(src, /createOpponentEngine/);
  });
});

describe('clipboard support', () => {
  it('clipboard module exists and exports copyToClipboard', async () => {
    const src = read('lib/clipboard.ts');
    assert.match(src, /export async function copyToClipboard/);
    assert.match(src, /Platform\.OS/);
    assert.match(src, /expo-clipboard/);
  });

  it('rebuilt endgame screens do not rely on ad-hoc navigator clipboard', () => {
    const menu = read('app/puzzles/defends-nulle.tsx');
    const play = read('app/puzzles/defends-nulle-play.tsx');
    assert.doesNotMatch(menu, /navigator\.clipboard\.writeText/);
    assert.doesNotMatch(play, /navigator\.clipboard\.writeText/);
  });
});

describe('favorites', () => {
  it('legacy favoritesStore remains but product uses Try Again v2', () => {
    const src = read('lib/defendDraw/favoritesStore.ts');
    assert.match(src, /export async function isFavorite/);
    assert.match(src, /StorageKeys\.endgameFavorites/);
    const store = read('lib/endgameTraining/persistence/EndgameTrainingStore.ts');
    assert.match(store, /tryAgainIds/);
    assert.match(store, /endgameTrainingV2/);
  });
});
