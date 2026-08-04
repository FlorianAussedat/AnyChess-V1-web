import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../../engine.ts';
import { OwnedEngine } from '../OwnedEngine.ts';

function mockEngine(): ChessEngine & { destroyed: boolean; id: number } {
  let n = mockEngine.seq++;
  return {
    id: n,
    destroyed: false,
    async pickMove(_game: Chess): Promise<Move | null> {
      return null;
    },
    cancel() {},
    destroy() {
      this.destroyed = true;
    },
  };
}
mockEngine.seq = 0;

describe('OwnedEngine', () => {
  it('creates once via ensure and reuses the same instance', () => {
    mockEngine.seq = 0;
    const owner = new OwnedEngine(() => mockEngine());
    const a = owner.ensure();
    const b = owner.ensure();
    assert.equal(a, b);
    assert.equal((a as ReturnType<typeof mockEngine>).id, 0);
  });

  it('destroy releases the engine and allows a fresh ensure', () => {
    mockEngine.seq = 0;
    const owner = new OwnedEngine(() => mockEngine());
    const first = owner.ensure() as ReturnType<typeof mockEngine>;
    owner.destroy();
    assert.equal(first.destroyed, true);
    assert.equal(owner.current, null);
    const second = owner.ensure() as ReturnType<typeof mockEngine>;
    assert.notEqual(first, second);
    assert.equal(second.id, 1);
    owner.destroy();
  });

  it('destroy is idempotent', () => {
    const owner = new OwnedEngine(() => mockEngine());
    owner.destroy();
    owner.destroy();
    assert.equal(owner.current, null);
  });
});
