/**
 * Shared Stockfish runtime + worker URL + position/engine decoupling tests.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import {
  getStockfishWorkerUrl,
  resolveStockfishPaths,
} from '../stockfishWorkerUrl.ts';
import { EndgameTrainingSession } from '../../../endgameTraining/session/EndgameTrainingSession.ts';
import { getPositionById } from '../../../endgameTraining/index.ts';
import { TheoreticalEndgameSession } from '../../../theoreticalEndgame/session/TheoreticalEndgameSession.ts';
import { getPositionById as getTheoreticalPositionById } from '../../../theoreticalEndgame/index.ts';
import { DEFAULT_STOCKFISH_CONFIG } from '../../stockfish/uci.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('stockfishWorkerUrl', () => {
  it('builds worker URL with wasm hash required by stockfish.js', () => {
    const { jsPath, wasmPath, workerUrl } = resolveStockfishPaths(
      DEFAULT_STOCKFISH_CONFIG.enginePath,
      'http://localhost:8081',
    );
    assert.equal(jsPath, '/engine/stockfish-18-lite-single.js');
    assert.equal(wasmPath, '/engine/stockfish-18-lite-single.wasm');
    assert.equal(
      workerUrl,
      `http://localhost:8081/engine/stockfish-18-lite-single.js#${encodeURIComponent('/engine/stockfish-18-lite-single.wasm')},worker`,
    );
  });

  it('prefixes origin when available', () => {
    const url = getStockfishWorkerUrl('http://localhost:8081', DEFAULT_STOCKFISH_CONFIG.enginePath);
    assert.match(url, /^http:\/\/localhost:8081\/engine\/stockfish-18-lite-single\.js#/);
    assert.match(url, /%2Fengine%2Fstockfish-18-lite-single\.wasm/);
  });
});

describe('web backend resolution', () => {
  it('uses createChessEngineService.web.ts with Worker transport', () => {
    const webFactory = read('lib/engines/analysis/createChessEngineService.web.ts');
    assert.match(webFactory, /transport\.web|createWebUciTransport/);
    assert.doesNotMatch(webFactory, /RandomEngine/);
    const webTransport = read('lib/engines/stockfish/transport.web.ts');
    assert.match(webTransport, /new Worker\(enginePath\)/);
  });

  it('StockfishEngine uses hashed worker URL on web', () => {
    const src = read('lib/engines/stockfish/StockfishEngine.ts');
    assert.match(src, /getStockfishWorkerUrl/);
    assert.match(src, /Platform\.OS === 'web'/);
  });

  it('native stub transport throws instead of falling back to RandomEngine', () => {
    const nativeTransport = read('lib/engines/stockfish/transport.ts');
    assert.match(nativeTransport, /throw new Error/);
    assert.match(nativeTransport, /createUciTransport/);
  });
});

describe('position decoupled from engine', () => {
  it('EndgameTrainingSession.start shows real FEN without analyzer', async () => {
    const pos = getPositionById('ET-LP-032ECE5A');
    assert.ok(pos);
    const session = new EndgameTrainingSession({});
    const idle = session.snapshot();
    assert.equal(idle.phase, 'idle');
    assert.equal(idle.fen, new Chess().fen());

    const snap = await session.start(pos!);
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.fen, pos!.fen);
    assert.notEqual(snap.fen, idle.fen);
    assert.equal(snap.movesResisted, 0);
    assert.ok(snap.evalCp !== 0 || pos!.quality.initialEvaluation === 0);
  });

  it('TheoreticalEndgameSession.start shows real FEN and target without analyzer', async () => {
    const pos = getTheoreticalPositionById('TE-001');
    assert.ok(pos);
    const session = new TheoreticalEndgameSession();
    const snap = await session.start(pos!);
    assert.equal(snap.phase, 'playing');
    assert.equal(snap.fen, pos!.initialFen);
    assert.equal(snap.targetUserMoves, pos!.targetUserMoves);
    assert.equal(snap.userMoves, 0);
  });
});

describe('SharedStockfishRuntime (static contract)', () => {
  it('singleton prewarm/retry and shared service without RandomEngine', () => {
    const src = read('lib/engines/runtime/SharedStockfishRuntime.ts');
    assert.match(src, /static get\(\)/);
    assert.match(src, /prewarm\(\)/);
    assert.match(src, /retry\(\)/);
    assert.match(src, /getStockfishWorkerUrl/);
    assert.match(src, /initPromise/);
    assert.doesNotMatch(src, /RandomEngine/);
    assert.match(src, /STOCKFISH_PLATFORM_NOTES\.web\.backend/);
  });

  it('play screens decouple position from engineReady', () => {
    const defendPlay = read('app/puzzles/defends-nulle-play.tsx');
    const theorPlay = read('app/puzzles/finales-theoriques-play.tsx');
    assert.doesNotMatch(defendPlay, /!engineReady \|\| !positionId/);
    assert.doesNotMatch(theorPlay, /!engineReady \|\| !positionId/);
    assert.match(defendPlay, /positionMissing|positionReady/);
    assert.match(theorPlay, /positionMissing|positionReady/);
    assert.match(defendPlay, /useSharedStockfishRuntime/);
    assert.match(theorPlay, /useSharedStockfishRuntime/);
  });

  it('menus prewarm shared runtime without blocking navigation', () => {
    const defendMenu = read('app/puzzles/defends-nulle.tsx');
    const theorMenu = read('app/puzzles/finales-theoriques.tsx');
    assert.match(defendMenu, /getSharedStockfishRuntime\(\)\.prewarm\(\)/);
    assert.match(theorMenu, /getSharedStockfishRuntime\(\)\.prewarm\(\)/);
  });
});

describe('pool counts unchanged', () => {
  it('defend-draw pool has 209 positions', () => {
    const pool = read('lib/endgameTraining/data/pool.generated.ts');
    const matches = pool.match(/"id":"ET-LP-/g);
    assert.equal(matches?.length, 209);
  });

  it('theoretical pool has 44 positions', () => {
    const pool = read('lib/theoreticalEndgame/data/pool.generated.ts');
    const matches = pool.match(/\bid: 'TE-/g);
    assert.equal(matches?.length, 44);
  });
});
