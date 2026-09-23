/**
 * G3a Classic: createOpponentEngine on Android uses StockfishEngine.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('G3a createOpponentEngine native Classic wiring', () => {
  it('Android factory builds StockfishEngine with RandomEngine init fallback', () => {
    const src = read('lib/engines/index.ts');
    assert.match(src, /Platform\.OS === 'android'/);
    assert.match(src, /withInitFallback\(new StockfishEngine/);
    assert.match(src, /randomEngine/);
    assert.match(src, /Platform\.OS === 'web'/);
    assert.match(src, /return new StockfishEngine\(partial\)/);
  });

  it('Classic GameContext still goes through createOpponentEngine only', () => {
    const classic = read('contexts/GameContext.tsx');
    assert.match(classic, /createOpponentEngine/);
    assert.doesNotMatch(classic, /new StockfishEngine/);
    assert.doesNotMatch(classic, /from ['\"]@\/lib\/engines\/random/);
  });

  it('does not wire Finales / Défends la nulle or change Elo helpers', () => {
    const runtime = read('lib/engines/runtime/SharedStockfishRuntime.ts');
    assert.match(runtime, /Platform\.OS !== 'web'/);
    assert.match(runtime, /Stockfish unavailable on native/);
    const uci = read('lib/engines/stockfish/uci.ts');
    assert.match(uci, /UCI_LimitStrength/);
    assert.match(uci, /MIN_UCI_ELO = 1320/);
  });

  it('web opponent factory path is unchanged', () => {
    const src = read('lib/engines/index.ts');
    assert.match(
      src,
      /if \(Platform\.OS === 'web'\) \{\s*return new StockfishEngine\(partial\);/s,
    );
  });
});
