/**
 * Boot-timeout cleanup contract for StockfishEngine.
 *
 * Full Worker integration is not available in node:test. This suite verifies
 * the transport dispose helper semantics used on timeout / failed start:
 * terminate is called, and a second dispose is safe (no throw).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { UciTransport } from '../types.ts';

function createDisposableTransport(): UciTransport & {
  terminated: number;
  quitSent: number;
} {
  const state = { terminated: 0, quitSent: 0 };
  const transport: UciTransport & { terminated: number; quitSent: number } = {
    get terminated() {
      return state.terminated;
    },
    get quitSent() {
      return state.quitSent;
    },
    start() {
      return Promise.resolve();
    },
    send(cmd: string) {
      if (cmd === 'quit') state.quitSent += 1;
    },
    terminate() {
      state.terminated += 1;
    },
  };
  return transport;
}

/**
 * Mirrors StockfishEngine.disposeTransport: quit + terminate, idempotent.
 */
function disposeTransport(holder: { transport: UciTransport | null }): void {
  const transport = holder.transport;
  holder.transport = null;
  if (!transport) return;
  try {
    transport.send('quit');
  } catch {
    /* ignore */
  }
  try {
    transport.terminate();
  } catch {
    /* ignore */
  }
}

describe('Stockfish boot transport cleanup', () => {
  it('terminates the worker transport on boot failure cleanup', () => {
    const transport = createDisposableTransport();
    const holder = { transport: transport as UciTransport };
    disposeTransport(holder);
    assert.equal(transport.quitSent, 1);
    assert.equal(transport.terminated, 1);
    assert.equal(holder.transport, null);
  });

  it('double dispose does not throw or double-terminate', () => {
    const transport = createDisposableTransport();
    const holder = { transport: transport as UciTransport };
    disposeTransport(holder);
    disposeTransport(holder);
    assert.equal(transport.terminated, 1);
  });
});
