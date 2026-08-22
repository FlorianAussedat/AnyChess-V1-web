/**
 * Stockfish main Worker URL — must NOT include the internal ",worker" suffix.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStockfishWorkerUrl, resolveStockfishPaths } from '../workerUrl.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('getStockfishWorkerUrl', () => {
  it('builds the main Stockfish worker URL without the internal worker suffix', () => {
    const url = getStockfishWorkerUrl();

    assert.match(url, /stockfish-18-lite-single\.js#/);
    assert.ok(decodeURIComponent(url).includes('stockfish-18-lite-single.wasm'));
    assert.doesNotMatch(url, /,worker/);
  });

  it('embeds wasm path in hash without ,worker when origin is explicit', () => {
    const { workerUrl } = resolveStockfishPaths(
      '/engine/stockfish-18-lite-single.js',
      'http://localhost:8081',
    );
    assert.equal(
      workerUrl,
      'http://localhost:8081/engine/stockfish-18-lite-single.js#%2Fengine%2Fstockfish-18-lite-single.wasm',
    );
    assert.doesNotMatch(workerUrl, /,worker/);
  });
});

describe('web consumers use centralized worker URL', () => {
  it('StockfishEngine uses getStockfishWorkerUrl on web', () => {
    const src = read('lib/engines/stockfish/StockfishEngine.ts');
    assert.match(src, /getStockfishWorkerUrl/);
    assert.match(src, /Platform\.OS === 'web'/);
  });

  it('ChessEngineService.web defaults to getStockfishWorkerUrl', () => {
    const src = read('lib/engines/analysis/createChessEngineService.web.ts');
    assert.match(src, /getStockfishWorkerUrl/);
  });

  it('SharedStockfishRuntime uses getStockfishWorkerUrl', () => {
    const src = read('lib/engines/runtime/SharedStockfishRuntime.ts');
    assert.match(src, /getStockfishWorkerUrl/);
  });

  it('main Worker transport does not append ,worker to enginePath', () => {
    const transport = read('lib/engines/stockfish/transport.web.ts');
    assert.match(transport, /new Worker\(enginePath\)/);
    assert.doesNotMatch(transport, /,worker/);
    const workerUrlSrc = read('lib/engines/stockfish/workerUrl.ts');
    assert.match(workerUrlSrc, /encodeURIComponent\(normalizedWasm\)/);
    assert.doesNotMatch(
      workerUrlSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''),
      /`[^`]*,worker/,
    );
  });
});
