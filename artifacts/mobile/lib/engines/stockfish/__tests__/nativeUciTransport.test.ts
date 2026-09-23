/**
 * Native UciTransport adapter — contract, line splitting, lifecycle guards.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createNativeUciTransport,
  type NativeStockfishBridge,
  type NativeStockfishEvent,
} from '../nativeUciTransport.ts';

function createFakeBridge(): NativeStockfishBridge & {
  started: number;
  terminated: number;
  sent: string[];
  emit(eventName: string, event: NativeStockfishEvent): void;
  crashOnSend?: boolean;
} {
  const listeners = new Map<string, Set<(event: NativeStockfishEvent) => void>>();
  const state = {
    started: 0,
    terminated: 0,
    sent: [] as string[],
    crashOnSend: false,
  };
  const bridge: NativeStockfishBridge & typeof state & {
    emit(eventName: string, event: NativeStockfishEvent): void;
  } = {
    get started() {
      return state.started;
    },
    get terminated() {
      return state.terminated;
    },
    get sent() {
      return state.sent;
    },
    get crashOnSend() {
      return state.crashOnSend;
    },
    set crashOnSend(v: boolean) {
      state.crashOnSend = v;
    },
    start: async () => {
      state.started += 1;
    },
    send(command: string) {
      if (state.crashOnSend) throw new Error('broken pipe');
      state.sent.push(command);
    },
    terminate() {
      state.terminated += 1;
    },
    addListener(eventName, listener) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName)!.add(listener);
      return {
        remove() {
          listeners.get(eventName)?.delete(listener);
        },
      };
    },
    emit(eventName, event) {
      for (const listener of listeners.get(eventName) ?? []) listener(event);
    },
  };
  return bridge;
}

describe('createNativeUciTransport contract', () => {
  it('forwards trimmed UCI lines and splits chunks', async () => {
    const bridge = createFakeBridge();
    const transport = createNativeUciTransport(bridge);
    const lines: string[] = [];
    await transport.start((line) => lines.push(line));
    bridge.emit('onLine', { line: 'uciok' });
    bridge.emit('onLine', { line: 'info depth 1\nbestmove e2e4\n' });
    bridge.emit('onLine', { line: '  readyok  ' });
    assert.deepEqual(lines, ['uciok', 'info depth 1', 'bestmove e2e4', 'readyok']);
  });

  it('send writes a single command line and ignores blanks', async () => {
    const bridge = createFakeBridge();
    const transport = createNativeUciTransport(bridge);
    await transport.start(() => {});
    transport.send('uci');
    transport.send('isready\n');
    transport.send('  ');
    assert.deepEqual(bridge.sent, ['uci', 'isready']);
  });

  it('terminate is idempotent and send-after-terminate is a no-op', async () => {
    const bridge = createFakeBridge();
    const transport = createNativeUciTransport(bridge);
    await transport.start(() => {});
    transport.terminate();
    transport.terminate();
    transport.send('go depth 10');
    assert.equal(bridge.terminated, 1);
    assert.equal(bridge.sent.length, 0);
  });

  it('start after terminate throws', async () => {
    const bridge = createFakeBridge();
    const transport = createNativeUciTransport(bridge);
    await transport.start(() => {});
    transport.terminate();
    await assert.rejects(
      () => transport.start(() => {}),
      /Cannot start after terminate/,
    );
  });

  it('send after a native crash does not throw', async () => {
    const bridge = createFakeBridge();
    const transport = createNativeUciTransport(bridge);
    const lines: string[] = [];
    await transport.start((line) => lines.push(line));
    bridge.emit('onExit', { code: 1 });
    bridge.crashOnSend = true;
    assert.doesNotThrow(() => transport.send('stop'));
    assert.ok(lines.some((l) => l.includes('native-exit')));
  });

  it('cancels in-flight start if terminate races the native boot', async () => {
    let resolveStart: () => void = () => {};
    const bridge = createFakeBridge();
    bridge.start = () =>
      new Promise((resolve) => {
        resolveStart = () => resolve();
      });
    const transport = createNativeUciTransport(bridge);
    const pending = transport.start(() => {});
    transport.terminate();
    resolveStart();
    await assert.rejects(pending, /Terminated before native start/);
    assert.ok(bridge.terminated >= 1);
  });
});
