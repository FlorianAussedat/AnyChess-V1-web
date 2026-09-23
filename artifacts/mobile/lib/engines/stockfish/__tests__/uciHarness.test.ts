/**
 * UCI smoke harness — protocol sequence + clear failures.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { UciTransport } from '../types.ts';
import { runUciSmokeTest, UciHarnessError } from '../uciHarness.ts';

function createScriptedEngine(script: {
  hangOn?: 'uciok' | 'readyok' | 'info' | 'bestmove' | 'stop';
  crashOnStart?: boolean;
}): UciTransport & { terminated: number; commands: string[] } {
  let onLine: ((line: string) => void) | null = null;
  const state = { terminated: 0, commands: [] as string[], goCount: 0 };
  return {
    get terminated() {
      return state.terminated;
    },
    get commands() {
      return state.commands;
    },
    start(cb) {
      if (script.crashOnStart) {
        return Promise.reject(new Error('engine did not start'));
      }
      onLine = cb;
      return Promise.resolve();
    },
    send(cmd: string) {
      state.commands.push(cmd);
      const emit = (line: string) => onLine?.(line);
      if (cmd === 'uci') {
        if (script.hangOn === 'uciok') return;
        emit('id name Stockfish 19');
        emit('uciok');
        return;
      }
      if (cmd === 'isready') {
        if (script.hangOn === 'readyok') return;
        emit('readyok');
        return;
      }
      if (cmd.startsWith('go ')) {
        state.goCount += 1;
        if (state.goCount === 1) {
          if (script.hangOn === 'info') return;
          emit('info depth 10 score cp 12 pv e7e5');
          if (script.hangOn === 'bestmove') return;
          emit('bestmove e7e5 ponder d2d4');
          return;
        }
        emit('info depth 4 score cp 10 pv d7d5');
        if (script.hangOn === 'stop') return;
        // stop is sent by the harness after this second go
      }
      if (cmd === 'stop') {
        if (script.hangOn === 'stop') return;
        emit('bestmove d7d5');
      }
    },
    terminate() {
      state.terminated += 1;
      onLine = null;
    },
  };
}

const fast = { startMs: 50, handshakeMs: 50, searchMs: 50, stopMs: 50 };

describe('runUciSmokeTest', () => {
  it('passes the G1 sequence against a scripted engine', async () => {
    const transport = createScriptedEngine({});
    const result = await runUciSmokeTest(transport, fast);
    assert.equal(result.ok, true);
    assert.ok(result.bestmove.startsWith('bestmove e7e5'));
    assert.ok(result.infoLines.length >= 1);
    assert.equal(transport.terminated, 1);
    assert.deepEqual(
      result.logs.map((l) => l.step),
      ['start', 'uciok', 'readyok', 'info', 'bestmove', 'search2', 'stop', 'terminate'],
    );
    assert.ok(result.logs.every((l) => l.ok));
    assert.ok(transport.commands.includes('position startpos moves e2e4 e7e5'));
    assert.ok(transport.commands.includes('go depth 10'));
    assert.ok(transport.commands.includes('stop'));
  });

  it('fails clearly when the engine does not start', async () => {
    const transport = createScriptedEngine({ crashOnStart: true });
    await assert.rejects(
      () => runUciSmokeTest(transport, fast),
      (err: unknown) => {
        assert.ok(err instanceof UciHarnessError);
        assert.equal(err.step, 'start');
        assert.match(err.message, /did not start/);
        return true;
      },
    );
    assert.equal(transport.terminated, 1);
  });

  it('fails clearly when uciok is absent', async () => {
    const transport = createScriptedEngine({ hangOn: 'uciok' });
    await assert.rejects(
      () => runUciSmokeTest(transport, fast),
      (err: unknown) => err instanceof UciHarnessError && err.step === 'uciok',
    );
    assert.equal(transport.terminated, 1);
  });

  it('fails clearly when readyok is absent', async () => {
    const transport = createScriptedEngine({ hangOn: 'readyok' });
    await assert.rejects(
      () => runUciSmokeTest(transport, fast),
      (err: unknown) => err instanceof UciHarnessError && err.step === 'readyok',
    );
  });

  it('fails clearly when bestmove is absent', async () => {
    const transport = createScriptedEngine({ hangOn: 'bestmove' });
    await assert.rejects(
      () => runUciSmokeTest(transport, fast),
      (err: unknown) => err instanceof UciHarnessError && err.step === 'bestmove',
    );
  });

  it('fails clearly when stop does not yield bestmove (timeout)', async () => {
    const transport = createScriptedEngine({ hangOn: 'stop' });
    await assert.rejects(
      () => runUciSmokeTest(transport, fast),
      (err: unknown) => err instanceof UciHarnessError && err.step === 'stop',
    );
    assert.equal(transport.terminated, 1);
  });
});
