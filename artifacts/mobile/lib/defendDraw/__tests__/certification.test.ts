/**
 * Certification rules for Défends la nulle dataset (authoring-time).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hasProvenDrawCertification,
  isAcceptableVerifiedDrawFlag,
} from '../certification.ts';
import { certifyDefendDrawPosition } from '../certifyPosition.ts';
import {
  getDefendDrawPosition,
  listCertifiedEndgames,
} from '../EndgamePositionRepository.ts';
import { CERTIFIED_DEFEND_DRAW_POSITIONS } from '../positions.ts';

describe('certification metadata', () => {
  it('rejects verifiedDraw alone without verification proof', () => {
    assert.equal(isAcceptableVerifiedDrawFlag(true, undefined), false);
    assert.equal(isAcceptableVerifiedDrawFlag(true, null), false);
    assert.equal(
      isAcceptableVerifiedDrawFlag(true, {
        method: 'syzygy',
        result: 'draw',
      } as never),
      true,
    );
    assert.equal(
      hasProvenDrawCertification({ method: 'stockfish', result: 'draw' }),
      false,
    );
    assert.equal(
      hasProvenDrawCertification({
        method: 'stockfish',
        result: 'draw',
        engine: 'Stockfish 18',
        depth: 22,
      }),
      true,
    );
  });

  it('every dataset row has proven certification', () => {
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(
        isAcceptableVerifiedDrawFlag(p.verifiedDraw, p.verification),
        true,
        p.id,
      );
      assert.equal(p.verification.result, 'draw', p.id);
    }
  });

  it('listCertifiedEndgames / getDefendDrawPosition only expose certified rows', () => {
    const all = listCertifiedEndgames();
    assert.ok(all.length >= 100);
    for (const p of all) {
      assert.equal(p.verification.result, 'draw');
      assert.ok(p.verification.method === 'syzygy' || p.verification.method === 'stockfish');
    }
    const expert = getDefendDrawPosition('expert', [], () => 0);
    assert.equal(expert.difficulty, 'expert');
    assert.equal(expert.verification.result, 'draw');
  });
});

describe('certifyDefendDrawPosition', () => {
  it('rejects invalid FEN', async () => {
    const r = await certifyDefendDrawPosition(
      {
        id: 'BAD',
        fen: 'not-a-fen',
        defenderColor: 'w',
        legalMoves: 1,
        drawingMoves: 1,
      },
      { allowStockfishFallback: false },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /invalid FEN|unparsable|FEN/i);
  });

  it('rejects Syzygy win', async () => {
    const r = await certifyDefendDrawPosition(
      {
        id: 'WIN',
        // Known win for STM (black mates / wins) — not a draw exercise.
        fen: '8/8/8/3Pk3/8/3K4/8/4r3 b - - 0 1',
        defenderColor: 'b',
        legalMoves: 15,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: false,
        fetchImpl: async () =>
          new Response(JSON.stringify({ category: 'win', moves: [] }), {
            status: 200,
          }),
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /win/i);
  });

  it('rejects Syzygy loss', async () => {
    const r = await certifyDefendDrawPosition(
      {
        id: 'LOSS',
        fen: '8/8/8/4k3/8/4q3/8/3RK3 w - - 0 1',
        defenderColor: 'w',
        legalMoves: 1,
        drawingMoves: 1,
      },
      {
        allowStockfishFallback: false,
        fetchImpl: async () =>
          new Response(JSON.stringify({ category: 'loss', moves: [] }), {
            status: 200,
          }),
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /loss/i);
  });

  it('accepts Syzygy draw', async () => {
    const r = await certifyDefendDrawPosition(
      {
        id: 'DRAW',
        fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
        defenderColor: 'b',
        legalMoves: 3,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: false,
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              category: 'draw',
              moves: [
                { category: 'draw' },
                { category: 'draw' },
                { category: 'loss' },
              ],
            }),
            { status: 200 },
          ),
      },
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.verification.method, 'syzygy');
      assert.equal(r.verification.result, 'draw');
      assert.equal(r.drawingMoves, 2);
    }
  });

  it('rejects when no certification proof is available', async () => {
    const r = await certifyDefendDrawPosition(
      {
        id: 'NONE',
        fen: '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1',
        defenderColor: 'b',
        legalMoves: 3,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: false,
        fetchImpl: async () => new Response('unavailable', { status: 503 }),
      },
    );
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /unavailable|inconclusive|no stockfish/i);
  });

  it('accepts conservative Stockfish draw when Syzygy cannot apply', async () => {
    // 8 pieces → above Syzygy max for our gate path when we force SF.
    const fen = '8/8/5k2/5ppp/8/5PPP/5K2/8 b - - 0 1';
    const r = await certifyDefendDrawPosition(
      {
        id: 'SF',
        fen,
        defenderColor: 'b',
        legalMoves: 9,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: true,
        fetchImpl: async () => new Response('no', { status: 404 }),
        stockfishAnalyze: async () => ({
          depth: 24,
          scoreCp: 8,
          mateIn: null,
          wdl: { win: 50, draw: 900, loss: 50 },
        }),
      },
    );
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.verification.method, 'stockfish');
      assert.equal(r.verification.result, 'draw');
      assert.equal(r.verification.depth, 24);
    }
  });

  it('rejects Stockfish mate / large eval as non-draw', async () => {
    const fen = '8/8/5k2/5ppp/8/5PPP/5K2/8 b - - 0 1';
    const mate = await certifyDefendDrawPosition(
      {
        id: 'SF-MATE',
        fen,
        defenderColor: 'b',
        legalMoves: 9,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: true,
        stockfishAnalyze: async () => ({
          depth: 24,
          scoreCp: -900000,
          mateIn: -3,
          wdl: null,
        }),
      },
    );
    assert.equal(mate.ok, false);

    const big = await certifyDefendDrawPosition(
      {
        id: 'SF-CP',
        fen,
        defenderColor: 'b',
        legalMoves: 9,
        drawingMoves: 2,
      },
      {
        allowStockfishFallback: true,
        stockfishAnalyze: async () => ({
          depth: 24,
          scoreCp: -200,
          mateIn: null,
          wdl: { win: 50, draw: 100, loss: 850 },
        }),
      },
    );
    assert.equal(big.ok, false);
  });
});
