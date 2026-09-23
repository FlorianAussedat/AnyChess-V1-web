/**
 * RandomEngine fallback when native Stockfish init fails.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../../engine.ts';
import { withInitFallback } from '../withInitFallback.ts';

function mockEngine(script: {
  init?: () => Promise<void>;
  pick?: () => Promise<Move | null>;
}): ChessEngine & {
  inits: number;
  picks: number;
  cancels: number;
  destroys: number;
  newGames: number;
} {
  const state = { inits: 0, picks: 0, cancels: 0, destroys: 0, newGames: 0 };
  return {
    get inits() {
      return state.inits;
    },
    get picks() {
      return state.picks;
    },
    get cancels() {
      return state.cancels;
    },
    get destroys() {
      return state.destroys;
    },
    get newGames() {
      return state.newGames;
    },
    async init() {
      state.inits += 1;
      if (script.init) await script.init();
    },
    async pickMove() {
      state.picks += 1;
      if (script.pick) return script.pick();
      return null;
    },
    cancel() {
      state.cancels += 1;
    },
    newGame() {
      state.newGames += 1;
    },
    destroy() {
      state.destroys += 1;
    },
  };
}

describe('withInitFallback', () => {
  it('uses the primary engine when init succeeds', async () => {
    const move = { from: 'e2', to: 'e4' } as Move;
    const primary = mockEngine({ pick: async () => move });
    const fallback = mockEngine({});
    const engine = withInitFallback(primary, fallback);
    await engine.init?.();
    const picked = await engine.pickMove(new Chess());
    assert.equal(picked, move);
    assert.equal(primary.inits, 1);
    assert.equal(primary.picks, 1);
    assert.equal(fallback.picks, 0);
    assert.equal(primary.destroys, 0);
  });

  it('falls back to RandomEngine path when native init fails', async () => {
    const move = { from: 'd2', to: 'd4' } as Move;
    const primary = mockEngine({
      init: async () => {
        throw new Error('StockfishUci unavailable');
      },
    });
    const fallback = mockEngine({ pick: async () => move });
    const engine = withInitFallback(primary, fallback);
    await engine.init?.();
    const picked = await engine.pickMove(new Chess());
    assert.equal(picked, move);
    assert.equal(fallback.picks, 1);
    assert.equal(primary.picks, 0);
    assert.equal(primary.destroys, 1);
  });

  it('pickMove settles init itself before choosing an engine', async () => {
    const move = { from: 'g1', to: 'f3' } as Move;
    const primary = mockEngine({
      init: async () => {
        throw new Error('spawn failed');
      },
    });
    const fallback = mockEngine({ pick: async () => move });
    const engine = withInitFallback(primary, fallback);
    const picked = await engine.pickMove(new Chess());
    assert.equal(picked, move);
    assert.equal(primary.destroys, 1);
  });

  it('destroy always tears down the primary engine', async () => {
    const primary = mockEngine({});
    const fallback = mockEngine({});
    const engine = withInitFallback(primary, fallback);
    await engine.init?.();
    engine.destroy?.();
    engine.destroy?.();
    assert.ok(primary.destroys >= 1);
    assert.equal(fallback.destroys, 0);
  });
});
