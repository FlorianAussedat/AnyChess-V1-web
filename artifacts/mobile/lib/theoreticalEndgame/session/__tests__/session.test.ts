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
      playerResult: 'WIN',
      dtz: 1,
      dtm: 1,
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
});
