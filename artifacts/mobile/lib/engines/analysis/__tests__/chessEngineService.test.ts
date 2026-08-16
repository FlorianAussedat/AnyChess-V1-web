/**
 * ChessEngineService — mock UCI transport (no WASM).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import type { UciTransport } from '../../stockfish/types.ts';
import { ChessEngineService } from '../ChessEngineService.ts';
import { parseInfoScoreSnapshot, parseBestMove } from '../../stockfish/uci.ts';
import { evaluateClearlyLostSignal } from '../../../defendDraw/isClearlyLostPosition.ts';
import { STOCKFISH_PLATFORM_NOTES } from '../types.ts';

function createScriptedTransport(script: {
  onCommand?: (cmd: string, send: (line: string) => void) => void;
}): UciTransport & { terminated: number; linesOut: string[] } {
  let onLine: ((line: string) => void) | null = null;
  const state = { terminated: 0, linesOut: [] as string[] };
  const sendOut = (line: string) => {
    state.linesOut.push(line);
    onLine?.(line);
  };
  return {
    get terminated() {
      return state.terminated;
    },
    get linesOut() {
      return state.linesOut;
    },
    start(cb) {
      onLine = cb;
      return Promise.resolve();
    },
    send(cmd: string) {
      if (cmd === 'uci') {
        sendOut('uciok');
        return;
      }
      if (cmd === 'isready') {
        sendOut('readyok');
        return;
      }
      if (cmd.startsWith('setoption')) return;
      if (cmd.startsWith('position fen')) {
        // remember fen via script
        script.onCommand?.(cmd, sendOut);
        return;
      }
      if (cmd.startsWith('go ')) {
        script.onCommand?.(cmd, sendOut);
        return;
      }
      if (cmd === 'stop' || cmd === 'quit') {
        script.onCommand?.(cmd, sendOut);
      }
    },
    terminate() {
      state.terminated += 1;
      onLine = null;
    },
  };
}

describe('UCI parsers', () => {
  it('parses uci info: depth, cp, mate, wdl, pv, bestmove', () => {
    const snap = parseInfoScoreSnapshot(
      'info depth 18 score cp 23 wdl 120 760 120 pv e2e4 e7e5',
    );
    assert.ok(snap);
    assert.equal(snap!.depth, 18);
    assert.equal(snap!.scoreCp, 23);
    assert.equal(snap!.mateIn, null);
    assert.deepEqual(snap!.wdl, { win: 120, draw: 760, loss: 120 });
    assert.equal(snap!.pvMove, 'e2e4');

    const mate = parseInfoScoreSnapshot('info depth 12 score mate 3 pv a1a8');
    assert.equal(mate!.mateIn, 3);

    const bm = parseBestMove('bestmove e2e4 ponder e7e5');
    assert.deepEqual(bm, { from: 'e2', to: 'e4', promotion: undefined });
  });
});

describe('ChessEngineService with scripted UCI', () => {
  it('boots via uci → uciok → isready → readyok', async () => {
    const transport = createScriptedTransport({});
    const engine = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
    });
    await engine.init();
    assert.equal(engine.getStatus(), 'ready');
    engine.destroy();
    assert.ok(transport.terminated >= 1);
  });

  it('returns a legal bestmove for the start position', async () => {
    let fen = '';
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('position fen')) {
          fen = cmd.slice('position fen '.length);
          return;
        }
        if (cmd.startsWith('go ')) {
          send('info depth 10 score cp 20 wdl 200 600 200 pv e2e4');
          send('bestmove e2e4');
        }
      },
    });
    const engine = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
    });
    const startFen = new Chess().fen();
    const analysis = await engine.analyzePosition({ fen: startFen });
    assert.equal(analysis.bestMove?.from, 'e2');
    assert.equal(analysis.bestMove?.to, 'e4');
    assert.equal(analysis.depth, 10);
    assert.ok(fen.includes('rnbqkbnr'));
    engine.destroy();
  });

  it('forwards a custom FEN and reports mate', async () => {
    const mateFen = '6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1';
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('go ')) {
          send('info depth 8 score mate 1 pv e1e8');
          send('bestmove e1e8');
        }
      },
    });
    const engine = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
    });
    const analysis = await engine.analyzePosition({ fen: mateFen });
    assert.equal(analysis.mateIn, 1);
    assert.equal(analysis.score?.type, 'mate');
    assert.equal(analysis.bestMove?.uci, 'e1e8');
    engine.destroy();
  });

  it('stop settles an in-flight analysis without mixing requests', async () => {
    let goCount = 0;
    const transport = createScriptedTransport({
      onCommand(cmd, send) {
        if (cmd.startsWith('go ')) {
          goCount += 1;
          if (goCount === 1) {
            // never finish first search — second call should stop it
            return;
          }
          send('info depth 6 score cp 0 pv d2d4');
          send('bestmove d2d4');
        }
      },
    });
    const engine = new ChessEngineService({
      createTransport: () => transport,
      moveTimeMs: 50,
      analysisTimeoutMs: 5000,
    });
    await engine.init();
    const first = engine.analyzePosition({ fen: new Chess().fen() });
    // Give the first go a tick, then start a second analysis (stops the first).
    await new Promise((r) => setTimeout(r, 10));
    const second = await engine.analyzePosition({ fen: new Chess().fen() });
    const firstResult = await first;
    assert.equal(second.bestMove?.from, 'd2');
    assert.equal(firstResult.bestMove, null); // stopped early
    engine.destroy();
  });
});

describe('WDL defender POV conversion', () => {
  it('inverts WDL when defender is not side to move', () => {
    const fenOppToMove = '8/8/8/4k3/8/4K3/8/8 b - - 0 1'; // black STM, defender white
    const signal = evaluateClearlyLostSignal(
      {
        scoreCp: 800,
        mateIn: null,
        depth: 14,
        wdl: { win: 950, draw: 30, loss: 20 }, // strong for STM (black)
        bestMove: null,
      },
      fenOppToMove,
      'w',
    );
    // Defender is white → STM win becomes defender loss
    assert.equal(signal.defenderLossPermille, 950);
    assert.equal(signal.lost, true);
    assert.equal(signal.reason, 'wdl');
  });

  it('does not treat mild cp as lost', () => {
    const fen = '8/8/8/4k3/8/4K3/8/8 w - - 0 1';
    const signal = evaluateClearlyLostSignal(
      {
        scoreCp: -180,
        mateIn: null,
        depth: 14,
        wdl: null,
        bestMove: null,
      },
      fen,
      'w',
    );
    assert.equal(signal.lost, false);
  });
});

describe('platform notes', () => {
  it('documents web WASM vs Expo Go native gap', () => {
    assert.equal(STOCKFISH_PLATFORM_NOTES.web.available, true);
    assert.equal(STOCKFISH_PLATFORM_NOTES.expoGo.supportsStockfish, false);
    assert.equal(STOCKFISH_PLATFORM_NOTES.android.available, false);
    assert.equal(STOCKFISH_PLATFORM_NOTES.ios.available, false);
  });
});
