/**
 * TheoreticalEndgameSession — mock DefenseAnalyzer coverage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { createMockDefenseAnalyzer } from '../../../defendDraw/mockDefenseAnalyzer.ts';
import type { DefenseAnalysis } from '../../../defendDraw/defenseTypes.ts';
import type { TheoreticalEndgamePosition } from '../domain/types.ts';
import { TheoreticalEndgameSession } from '../TheoreticalEndgameSession.ts';
import { THEORETICAL_ENDGAME_POOL } from '../../data/pool.generated.ts';
import { assessDefense } from '../../domain/defenseFinish.ts';
import { THEORETICAL_ENDGAME_CONFIG } from '../../domain/types.ts';

function baseAnalysis(partial: Partial<DefenseAnalysis> = {}): DefenseAnalysis {
  return {
    scoreCp: 0,
    mateIn: null,
    depth: 12,
    wdl: { win: 900, draw: 50, loss: 50 },
    bestMove: { from: 'e1', to: 'e2' },
    ...partial,
  };
}

function firstLegalBest(fen: string) {
  const g = new Chess(fen);
  const m = g.moves({ verbose: true })[0];
  return m ? { from: m.from, to: m.to, promotion: m.promotion } : null;
}

function samplePosition(
  overrides: Partial<TheoreticalEndgamePosition> = {},
): TheoreticalEndgamePosition {
  return {
    id: 'TEST-TE-1',
    themeId: 'queen-mate',
    initialFen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    playerColor: 'white',
    objective: 'WIN',
    objectiveKind: 'mate',
    completion: { type: 'CHECKMATE' },
    certification: { type: 'SYZYGY', result: 'WIN' },
    proof: {
      method: 'syzygy-7',
      confidence: 'exact',
      category: 'win',
      playerResult: 'WIN',
      dtz: 1,
      dtm: 1,
      dtmReported: 1,
      source: 'lichess-syzygy',
      consultedAt: 'test',
    },
    contentVersion: 'variants-v2',
    variantNote: { fr: 'test', en: 'test' },
    diagramOrientation: 'white',
    active: true,
    explanation: {
      fr: { principle: '', seek: '', method: '', avoid: '' },
      en: { principle: '', seek: '', method: '', avoid: '' },
    },
    tags: ['test'],
    ...overrides,
  };
}

describe('TheoreticalEndgameSession', () => {
  it('blocks moves while engine is thinking', async () => {
    const pos = samplePosition();
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({ bestMove: firstLegalBest(fen) }),
    );
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    const before = session.snapshot();
    assert.equal(before.phase, 'playing');
    assert.ok(before.canOfferActions === false);
  });

  it('succeeds on checkmate for WIN objective', async () => {
    const pos = samplePosition({
      initialFen: '7k/8/6KQ/8/8/8/8/8 w - - 0 1',
    });
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        wdl: { win: 50, draw: 50, loss: 900 },
      }),
    );
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    const snap = await session.attemptMove('h6', 'h7');
    assert.equal(snap.phase, 'success');
    assert.equal(snap.result?.outcome, 'success');
  });

  it('detects theoretical loss with confirmation', async () => {
    const pos = samplePosition({
      initialFen: '8/8/8/8/8/5k2/8/6KQ w - - 0 1',
    });
    let call = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      call += 1;
      const lost = call <= 2;
      return baseAnalysis({
        bestMove: firstLegalBest(fen),
        wdl: lost
          ? { win: 50, draw: 900, loss: 50 }
          : { win: 900, draw: 50, loss: 50 },
        scoreCp: lost ? 0 : 800,
      });
    });
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    const g = new Chess(pos.initialFen);
    const m = g.moves({ verbose: true }).find((mv) => mv.san !== 'Kh2')!;
    const snap = await session.attemptMove(m.from, m.to, m.promotion ?? 'q');
    assert.equal(snap.phase, 'theoretical-loss');
    assert.ok(snap.result?.firstTheoreticalLoss);
  });

  it('abandon does not count as success', () => {
    const session = new TheoreticalEndgameSession();
    void session.start(samplePosition());
    const snap = session.abandon();
    assert.equal(snap.phase, 'abandoned');
    assert.equal(snap.result?.outcome, 'abandoned');
    assert.equal(snap.result?.attemptScore, null);
  });

  it('enterFinishGame keeps score locked', async () => {
    const pos = samplePosition({
      initialFen: '8/8/8/8/8/5k2/8/6KQ w - - 0 1',
    });
    let call = 0;
    const analyzer = createMockDefenseAnalyzer((fen) => {
      call += 1;
      const lost = call <= 2;
      return baseAnalysis({
        bestMove: firstLegalBest(fen),
        wdl: lost
          ? { win: 50, draw: 900, loss: 50 }
          : { win: 900, draw: 50, loss: 50 },
      });
    });
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    const g = new Chess(pos.initialFen);
    const m = g.moves({ verbose: true })[0]!;
    await session.attemptMove(m.from, m.to, m.promotion ?? 'q');
    const off = session.enterFinishGameSync();
    assert.equal(off.finishGameActive, true);
    assert.equal(off.phase, 'finish-game');
    assert.equal(off.scoreLocked, true);
  });

  it('a late engine reply does not change a locked result', async () => {
    let release: ((value: DefenseAnalysis) => void) | null = null;
    const analyzer = createMockDefenseAnalyzer(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(samplePosition());
    const pending = session.attemptMove('h1', 'h2');
    session.abandon();
    release?.(baseAnalysis({ bestMove: firstLegalBest(session.snapshot().fen) }));
    const snap = await pending;
    assert.equal(snap.phase, 'abandoned');
    assert.equal(snap.result?.attemptScore, null);
  });

  it('restores the same FEN and does not require a target', async () => {
    const session = new TheoreticalEndgameSession();
    const pos = samplePosition();
    await session.start(pos);
    const moved = new Chess(pos.initialFen);
    const m = moved.moves({ verbose: true })[0]!;
    moved.move(m);
    const restored = session.restore({
      position: pos,
      fen: moved.fen(),
      startFen: pos.initialFen,
      moveSans: [m.san],
      userMoves: 1,
      startedAt: Date.now() - 1000,
    });
    assert.equal(restored.fen, moved.fen());
    assert.equal(restored.userMoves, 1);
    assert.deepEqual(restored.moveSans, [m.san]);
    assert.equal('targetUserMoves' in restored, false);
  });

  it('keeps a low score when the opponent shortens the mate after wasted tempi', async () => {
    const fen = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
    const pos = samplePosition({
      initialFen: fen,
      proof: {
        method: 'syzygy-7',
        confidence: 'exact',
        category: 'win',
        playerResult: 'WIN',
        dtz: 11,
        dtm: 11,
        dtmReported: 11,
        source: 'lichess-syzygy',
        consultedAt: 'test',
      },
    });
    const userMoves = [
      { from: 'e1', to: 'e2' },
      { from: 'e2', to: 'f3' },
      { from: 'h1', to: 'g2' },
      { from: 'g2', to: 'g4' },
    ];
    const opponent = [
      { from: 'e5', to: 'f6' },
      { from: 'f6', to: 'g5' },
      { from: 'g5', to: 'h4' },
    ];
    const afterUser = [-12, -6, -4];
    const beforeNext = [5, 3, 1];
    const byFen = new Map<string, DefenseAnalysis>();
    const game = new Chess(fen);
    for (let i = 0; i < opponent.length; i++) {
      game.move(userMoves[i]!);
      byFen.set(
        game.fen(),
        baseAnalysis({
          mateIn: afterUser[i]!,
          bestMove: opponent[i]!,
          wdl: { win: 900, draw: 50, loss: 50 },
        }),
      );
      game.move(opponent[i]!);
      byFen.set(
        game.fen(),
        baseAnalysis({
          mateIn: beforeNext[i]!,
          bestMove: { from: userMoves[i + 1]!.from, to: userMoves[i + 1]!.to },
          wdl: { win: 900, draw: 50, loss: 50 },
        }),
      );
    }
    const analyzer = createMockDefenseAnalyzer((positionFen) => {
      const found = byFen.get(positionFen);
      if (!found) throw new Error(`unscripted ${positionFen}`);
      return found;
    });
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    let snap = session.snapshot();
    for (const move of userMoves) {
      snap = await session.attemptMove(move.from, move.to);
    }
    assert.equal(snap.phase, 'success');
    assert.equal(snap.userMoves, 4);
    assert.equal(snap.result?.attemptScore, 3.5);
    assert.notEqual(snap.result?.attemptScore, 5);
    assert.equal(snap.result?.quality?.reason, 'mate-distance');
  });

  it('does not end a defence just because the evaluation is 0.00', async () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-PHILIDOR')!;
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        wdl: { win: 0, draw: 1000, loss: 0 },
        scoreCp: 0,
        mateIn: null,
      }),
    );
    const session = new TheoreticalEndgameSession(analyzer);
    await session.start(pos);
    const game = new Chess(pos.initialFen);
    const quiet = game.moves({ verbose: true }).find((move) => {
      const assessed = assessDefense({
        themeId: pos.themeId,
        initialFen: pos.initialFen,
        sans: [move.san],
        playerColor: pos.playerColor,
        objective: 'DRAW',
      });
      return !assessed.complete;
    });
    assert.ok(quiet);
    const snap = await session.attemptMove(quiet!.from, quiet!.to, quiet!.promotion ?? 'q');
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.scoreLocked, false);
    assert.equal(snap.result, null);
  });

  it('stops a defence that never finishes by the cap or by the chess rules', async () => {
    const pos = THEORETICAL_ENDGAME_POOL.find((p) => p.id === 'TE-CANON-VANCURA-1')!;
    const analyzer = createMockDefenseAnalyzer((fen) =>
      baseAnalysis({
        bestMove: firstLegalBest(fen),
        wdl: { win: 0, draw: 1000, loss: 0 },
        scoreCp: 0,
        mateIn: null,
      }),
    );
    const session = new TheoreticalEndgameSession(analyzer);
    let snap = await session.start(pos);
    for (let n = 0; n < THEORETICAL_ENDGAME_CONFIG.technicalUserMoveCap && snap.phase === 'playing'; n++) {
      const game = new Chess(snap.fen);
      if (game.turn() !== 'b') break;
      const move = game.moves({ verbose: true })[0];
      if (!move) break;
      snap = await session.attemptMove(move.from, move.to, move.promotion ?? 'q');
    }
    assert.notEqual(snap.phase, 'playing');
    assert.ok(snap.userMoves <= THEORETICAL_ENDGAME_CONFIG.technicalUserMoveCap);
    assert.notEqual(snap.result?.attemptScore, 2);
    if (snap.result?.quality?.reason === 'unevaluated') {
      assert.equal(snap.result.attemptScore, null);
    }
  });
});
