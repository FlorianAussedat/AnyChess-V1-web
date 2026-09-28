import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import type { ChessEngine } from '../../engine.ts';
import { requestOpponentMove } from '../requestOpponentMove.ts';

function moveE2E4(): Move {
  const g = new Chess();
  return g.moves({ verbose: true }).find((m) => m.from === 'e2' && m.to === 'e4') as Move;
}

function engineWith(
  impl: Partial<ChessEngine> & { pickMove: ChessEngine['pickMove'] },
): ChessEngine {
  return {
    init: impl.init,
    pickMove: impl.pickMove,
    cancel: impl.cancel,
    destroy: impl.destroy,
  };
}

describe('requestOpponentMove', () => {
  it('waits for init then returns the engine move', async () => {
    let ready = false;
    const engine = engineWith({
      async init() {
        await Promise.resolve();
        ready = true;
      },
      async pickMove() {
        assert.equal(ready, true);
        return moveE2E4();
      },
    });
    const game = new Chess();
    const out = await requestOpponentMove({
      engine,
      game,
      requestId: 1,
      isCurrent: (id) => id === 1,
      mode: 'classic',
      retryOnce: false,
    });
    assert.equal(out.kind, 'move');
    if (out.kind === 'move') {
      assert.equal(out.move.from, 'e2');
      assert.equal(out.move.to, 'e4');
    }
  });

  it('ignores a late reply after the request id changed', async () => {
    let current = 1;
    let release: (() => void) | undefined;
    const engine = engineWith({
      async pickMove() {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return moveE2E4();
      },
    });
    const pending = requestOpponentMove({
      engine,
      game: new Chess(),
      requestId: 1,
      isCurrent: (id) => id === current,
      mode: 'classic',
      retryOnce: false,
    });
    current = 2;
    release?.();
    const out = await pending;
    assert.equal(out.kind, 'cancelled');
  });

  it('treats a terminal FEN as a normal end, not an engine error', async () => {
    const mate = new Chess(
      'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    );
    assert.equal(mate.isCheckmate(), true);
    let called = 0;
    const engine = engineWith({
      async pickMove() {
        called += 1;
        return null;
      },
    });
    const out = await requestOpponentMove({
      engine,
      game: mate,
      requestId: 1,
      isCurrent: () => true,
      mode: 'classic',
    });
    assert.equal(out.kind, 'terminal');
    assert.equal(called, 0);
  });

  it('retries once on a recoverable empty reply, then errors', async () => {
    let calls = 0;
    const engine = engineWith({
      async pickMove() {
        calls += 1;
        return null;
      },
    });
    const out = await requestOpponentMove({
      engine,
      game: new Chess(),
      requestId: 1,
      isCurrent: () => true,
      mode: 'classic',
    });
    assert.equal(out.kind, 'error');
    assert.equal(calls, 2);
  });

  it('does not apply a move if the board FEN changed during search', async () => {
    const game = new Chess();
    const engine = engineWith({
      async pickMove() {
        game.move('e4');
        return moveE2E4();
      },
    });
    const out = await requestOpponentMove({
      engine,
      game,
      requestId: 1,
      isCurrent: () => true,
      mode: 'classic',
      retryOnce: false,
    });
    assert.equal(out.kind, 'cancelled');
  });

  it('reports a missing engine as a recoverable error', async () => {
    const out = await requestOpponentMove({
      engine: null,
      game: new Chess(),
      requestId: 1,
      isCurrent: () => true,
      mode: 'classic',
      retryOnce: false,
    });
    assert.equal(out.kind, 'error');
    if (out.kind === 'error') assert.equal(out.reason, 'no-engine');
  });
});
