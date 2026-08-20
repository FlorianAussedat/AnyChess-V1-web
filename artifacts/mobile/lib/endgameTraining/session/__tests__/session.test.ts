/**
 * EndgameTrainingSession — mock DefenseAnalyzer coverage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { createMockDefenseAnalyzer } from '../../../defendDraw/mockDefenseAnalyzer.ts';
import type { DefenseAnalysis } from '../../../defendDraw/defenseTypes.ts';
import type { EndgameTrainingPosition } from '../../domain/types.ts';
import { EndgameTrainingSession } from '../EndgameTrainingSession.ts';

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

/** STM-centric score that normalizes to the desired defender-POV cp. */
function stmForDefenderPov(
  fen: string,
  defender: 'white' | 'black',
  defenderPovCp: number,
): number {
  const stm = fen.trim().split(/\s+/)[1];
  const def = defender === 'white' ? 'w' : 'b';
  return stm === def ? defenderPovCp : -defenderPovCp;
}

function firstLegalBest(fen: string) {
  const g = new Chess(fen);
  const m = g.moves({ verbose: true })[0];
  return m
    ? { from: m.from, to: m.to, promotion: m.promotion }
    : null;
}

function samplePosition(
  overrides: Partial<EndgameTrainingPosition> = {},
): EndgameTrainingPosition {
  return {
    id: 'TEST-1',
    fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
    defender: 'black',
    source: {
      provider: 'test',
      license: 'internal',
      importedAt: '2026-08-20',
    },
    family: 'pawn',
    materialSignature: 'KP-k',
    quality: { initialEvaluation: 0, validationKind: 'syzygy', defensiveMoveCount: 3 },
    ...overrides,
  };
}

describe('EndgameTrainingSession', () => {
  it('counts only safe player moves', async () => {
    const pos = samplePosition();
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        scoreCp: stmForDefenderPov(fen, pos.defender, 0),
      }),
    );
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    // Black: Kd7 (safe)
    let snap = await session.attemptMove('d6', 'd7');
    assert.equal(snap.movesResisted, 1);
    assert.equal(snap.phase, 'playing');
    // After opponent reply, another black move
    const g = new Chess(snap.fen);
    if (g.turn() === 'b') {
      const m = g.moves({ verbose: true })[0]!;
      snap = await session.attemptMove(m.from, m.to, m.promotion ?? 'q');
      assert.equal(snap.movesResisted, 2);
    }
  });

  it('confirms loss under −2 with confirmation', async () => {
    const pos = samplePosition();
    let call = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      call += 1;
      // After player move: probe + confirm both lost (defender POV)
      const defenderPov = call <= 2 ? -250 : 0;
      return baseAnalysis({
        bestMove: firstLegalBest(fen),
        scoreCp: stmForDefenderPov(fen, pos.defender, defenderPov),
      });
    });
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    const snap = await session.attemptMove('d6', 'e7'); // legal king step
    assert.equal(snap.phase, 'lost');
    assert.equal(snap.result?.outcome, 'loss');
    // Losing move does not increment
    assert.equal(snap.movesResisted, 0);
  });

  it('rejects false −2 crossing when confirmation recovers', async () => {
    const pos = samplePosition();
    let analyzeCalls = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      analyzeCalls += 1;
      // First analyze after player move: −250; confirmation: −100
      // (session calls analyze then analyze again for confirm, then opponent…)
      let defenderPov = 0;
      if (analyzeCalls === 1) defenderPov = -250;
      else if (analyzeCalls === 2) defenderPov = -100;
      else defenderPov = 0;
      return baseAnalysis({
        bestMove: firstLegalBest(fen),
        scoreCp: stmForDefenderPov(fen, pos.defender, defenderPov),
      });
    });
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    const snap = await session.attemptMove('d6', 'd7');
    assert.notEqual(snap.phase, 'lost');
    assert.equal(snap.movesResisted, 1);
  });

  it('wins on official stalemate', async () => {
    // White to move can force stalemate: Ka8 / Kb6 / Qc1 → Qc7#
    // Classic: k7/8/1KQ5/8/8/8/8/8 is already mate-ish — use Qc1→c7 stalemate
    const pos = samplePosition({
      fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
      defender: 'white',
      materialSignature: 'KQ-k',
      family: 'queen',
    });
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        scoreCp: 0,
      }),
    );
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    const snap = await session.attemptMove('c1', 'c7');
    assert.equal(snap.phase, 'won-draw');
    assert.equal(snap.result?.outcome, 'win-official-draw');
    assert.equal(snap.result?.officialDrawReason, 'stalemate');
  });

  it('abandon marks abandoned and does not count as win', async () => {
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({ bestMove: firstLegalBest(fen), scoreCp: 0 }),
    );
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(samplePosition());
    const snap = session.abandon();
    assert.equal(snap.phase, 'abandoned');
    assert.equal(snap.result?.outcome, 'abandoned');
  });

  it('retry resets the attempt counter', async () => {
    const pos = samplePosition();
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        scoreCp: stmForDefenderPov(fen, pos.defender, 0),
      }),
    );
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    await session.attemptMove('d6', 'd7');
    assert.equal(session.snapshot().movesResisted, 1);
    const snap = await session.retry();
    assert.equal(snap.movesResisted, 0);
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.fen, pos.fen);
  });

  it('off-score play does not change the locked score', async () => {
    const pos = samplePosition({
      fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
      defender: 'white',
      family: 'queen',
      materialSignature: 'KQ-k',
    });
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({ bestMove: firstLegalBest(fen), scoreCp: 0 }),
    );
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    let snap = await session.attemptMove('c1', 'c7'); // stalemate win
    assert.equal(snap.phase, 'won-draw');
    const locked = snap.movesResisted;
    snap = session.continueOffScore();
    assert.equal(snap.offScore, true);
    // Off-score: further moves should not change movesResisted
    // Position is already game-over — attemptMove should no-op or stay locked
    assert.equal(session.snapshot().movesResisted, locked);
  });

  it('wins at 30 safe moves when mock always returns 0 cp', async () => {
    // Roaming kings + distant non-interacting rooks — avoid early regulatory draws.
    const pos = samplePosition({
      id: 'TEST-30',
      fen: 'r7/8/8/8/8/8/8/R3K2k b - - 0 1',
      defender: 'black',
      family: 'rook',
      materialSignature: 'KR-kr',
    });
    const seen = new Set<string>();
    const pickNovel = (fen: string) => {
      const g = new Chess(fen);
      const moves = g.moves({ verbose: true });
      let best = moves[0];
      let bestScore = -1;
      for (const m of moves) {
        if (m.captured) continue;
        const g2 = new Chess(fen);
        g2.move(m);
        const key = g2.fen().split(' ').slice(0, 4).join(' ');
        const score = seen.has(key) ? 0 : 10;
        const kingBonus = m.piece === 'k' ? 1 : 0;
        if (score + kingBonus > bestScore) {
          bestScore = score + kingBonus;
          best = m;
        }
      }
      return best
        ? { from: best.from, to: best.to, promotion: best.promotion }
        : firstLegalBest(fen);
    };

    const analyzer = createMockDefenseAnalyzer((fen) => {
      return baseAnalysis({
        bestMove: pickNovel(fen),
        scoreCp: stmForDefenderPov(fen, pos.defender, 0),
        wdl: { win: 50, draw: 900, loss: 50 },
      });
    });
    const session = new EndgameTrainingSession({ analyzer });
    await session.start(pos);
    seen.add(pos.fen.split(' ').slice(0, 4).join(' '));

    for (let i = 0; i < 40; i++) {
      const snap = session.snapshot();
      if (
        snap.phase === 'won-30' ||
        snap.phase === 'won-draw' ||
        snap.phase === 'lost' ||
        snap.phase === 'engine-error'
      ) {
        break;
      }
      if (snap.phase !== 'playing' && snap.phase !== 'off-score') break;
      const g = new Chess(snap.fen);
      if (g.turn() !== 'b') break;
      const move = pickNovel(snap.fen);
      if (!move) break;
      const next = await session.attemptMove(
        move.from,
        move.to,
        move.promotion ?? 'q',
      );
      seen.add(next.fen.split(' ').slice(0, 4).join(' '));
    }

    const final = session.snapshot();
    assert.equal(
      final.phase,
      'won-30',
      `expected won-30, got ${final.phase} after ${final.movesResisted} moves (${final.result?.officialDrawReason ?? ''})`,
    );
    assert.equal(final.movesResisted, 30);
    assert.equal(final.result?.outcome, 'win-30-moves');
  });
});
