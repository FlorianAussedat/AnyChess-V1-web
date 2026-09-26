/**
 * Game-engine session: one process, level changes via setoption,
 * stale bestmove discarded.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { StockfishEngine } from '../StockfishEngine.ts';
import type { UciTransport } from '../types.ts';
import { resetUciEloBounds } from '../uci.ts';

const here = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function scriptedTransport() {
  let onLine: ((line: string) => void) | null = null;
  const commands: string[] = [];
  let starts = 0;
  let releaseGo: ((line: string) => void) | null = null;
  let pendingStop: (() => void) | null = null;

  const transport: UciTransport & {
    commands: string[];
    starts: number;
    holdNextGo: boolean;
    emit: (line: string) => void;
    emitStopReply: () => void;
  } = {
    commands,
    get starts() {
      return starts;
    },
    holdNextGo: false,
    emit(line: string) {
      onLine?.(line);
    },
    emitStopReply() {
      pendingStop?.();
      pendingStop = null;
    },
    start(cb) {
      starts += 1;
      onLine = cb;
      return Promise.resolve();
    },
    send(cmd: string) {
      commands.push(cmd);
      if (cmd === 'uci') {
        onLine?.('option name UCI_Elo type spin default 1320 min 1320 max 3190');
        onLine?.('uciok');
        return;
      }
      if (cmd === 'isready') {
        onLine?.('readyok');
        return;
      }
      if (cmd === 'stop') {
        pendingStop = () => onLine?.('bestmove a2a3');
        return;
      }
      if (cmd.startsWith('go ')) {
        if (transport.holdNextGo) {
          transport.holdNextGo = false;
          releaseGo = (line) => onLine?.(line);
          return;
        }
        onLine?.('bestmove e2e4');
      }
    },
    terminate() {
      onLine = null;
    },
  };

  return {
    transport,
    replyGo(line: string) {
      const reply = releaseGo;
      releaseGo = null;
      reply?.(line);
    },
  };
}

describe('StockfishEngine game session', () => {
  it('keeps one transport across moves and new games', async () => {
    resetUciEloBounds();
    const { transport } = scriptedTransport();
    const engine = new StockfishEngine(
      { elo: 2000, multiPv: 1, varietyMarginCp: 0, moveTimeMs: 680 },
      { createTransport: () => transport },
    );
    await engine.init();
    const game = new Chess();
    const first = await engine.pickMove(game);
    await engine.newGame();
    const second = await engine.pickMove(game);
    assert.equal(transport.starts, 1);
    assert.equal(first?.from, 'e2');
    assert.equal(second?.from, 'e2');
    assert.equal(transport.commands.filter((cmd) => cmd === 'uci').length, 1);
    assert.ok(transport.commands.filter((cmd) => cmd === 'ucinewgame').length >= 2);
    const gameGoes = transport.commands.filter((cmd) => cmd.startsWith('go depth'));
    assert.ok(gameGoes.some((cmd) => cmd !== 'go depth 1'));
    engine.destroy();
  });

  it('updates 1200 → 2000 options before the next go', async () => {
    resetUciEloBounds();
    const { transport } = scriptedTransport();
    const engine = new StockfishEngine(
      { elo: 1200, multiPv: 8, varietyMarginCp: 120, moveTimeMs: 600 },
      { createTransport: () => transport },
    );
    await engine.init();
    assert.ok(
      transport.commands.includes('setoption name UCI_LimitStrength value true'),
    );
    assert.ok(transport.commands.includes('setoption name UCI_Elo value 1320'));
    assert.ok(transport.commands.includes('setoption name MultiPV value 8'));
    assert.equal(
      transport.commands.some((cmd) => cmd.includes('Skill Level')),
      false,
    );

    const before = transport.commands.length;
    await engine.applyStrength({
      elo: 2000,
      multiPv: 1,
      varietyMarginCp: 0,
      moveTimeMs: 680,
    });
    const updated = transport.commands.slice(before);
    assert.ok(updated.includes('setoption name UCI_Elo value 2000'));
    assert.ok(updated.includes('setoption name MultiPV value 1'));
    assert.equal(
      updated.some((cmd) => cmd.includes('Skill Level')),
      false,
    );

    transport.holdNextGo = true;
    const pending = engine.pickMove(new Chess());
    await flush();
    const go = transport.commands.find(
      (cmd, index) => index >= before && cmd.startsWith('go depth') && cmd !== 'go depth 1',
    );
    assert.ok(go, `missing game go in ${transport.commands.join(' | ')}`);
    assert.match(go!, /^go depth (\d+) movetime (\d+)$/);
    const depth = Number(/^go depth (\d+)/.exec(go!)?.[1]);
    const movetime = Number(/movetime (\d+)/.exec(go!)?.[1]);
    assert.ok(depth >= 7);
    assert.ok(movetime >= 500);
    const goAt = transport.commands.lastIndexOf(go!);
    const eloAt = transport.commands.lastIndexOf('setoption name UCI_Elo value 2000');
    assert.ok(eloAt >= 0 && eloAt < goAt);
    transport.holdNextGo = false;
    // replyGo only works if hold consumed the waiter. The go was held.
    // Emit the move the engine is waiting for.
    transport.emit('bestmove e2e4');
    const move = await pending;
    assert.equal(`${move?.from}${move?.to}`, 'e2e4');
    engine.destroy();
  });

  it('does not play a bestmove from the search that was stopped', async () => {
    resetUciEloBounds();
    const script = scriptedTransport();
    const { transport } = script;
    const engine = new StockfishEngine(
      { elo: 2000, multiPv: 1, varietyMarginCp: 0, moveTimeMs: 680 },
      { createTransport: () => transport },
    );
    await engine.init();
    transport.holdNextGo = true;
    const first = engine.pickMove(new Chess());
    await flush();
    engine.cancel();
    transport.holdNextGo = true;
    const second = engine.pickMove(new Chess());
    await flush();
    // Stale reply from the cancelled search. It must not become the next move,
    // even if it arrives after the following search has been requested.
    transport.emitStopReply();
    await flush();
    script.replyGo('bestmove d2d4');
    const [cancelled, played] = await Promise.all([first, second]);
    assert.equal(cancelled, null);
    assert.equal(`${played?.from}${played?.to}`, 'd2d4');
    engine.destroy();
  });

  it('Classic reuses the engine instead of destroying it on a new game', () => {
    const classic = read('../../../../contexts/GameContext.tsx');
    assert.match(classic, /engine\.newGame\?\.\(\)/);
    assert.match(classic, /applyStrength\?\./);
    assert.doesNotMatch(classic, /recreateEngine/);
  });
});
