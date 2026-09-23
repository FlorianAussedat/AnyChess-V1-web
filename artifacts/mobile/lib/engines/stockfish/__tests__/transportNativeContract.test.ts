/**
 * Native vs web transport isolation (static contract).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('native transport contract vs web', () => {
  it('implements UciTransport via StockfishUci without RandomEngine', () => {
    const native = read('lib/engines/stockfish/transport.ts');
    assert.match(native, /createNativeUciTransport/);
    assert.match(native, /StockfishUci/);
    assert.match(native, /createUciTransport/);
    assert.doesNotMatch(native, /RandomEngine/);
    assert.doesNotMatch(native, /new Worker/);
    assert.match(native, /Platform\.OS === 'android'/);
    assert.match(native, /AppState/);
  });

  it('web Worker transport is unchanged and has no native imports', () => {
    const web = read('lib/engines/stockfish/transport.web.ts');
    assert.match(web, /new Worker\(enginePath\)/);
    assert.doesNotMatch(web, /StockfishUci/);
    assert.doesNotMatch(web, /requireNativeModule|requireOptionalNativeModule/);
    assert.doesNotMatch(web, /stockfish-uci/);
    assert.doesNotMatch(web, /ProcessBuilder|libstockfish/);
  });

  it('DEV harness is gated and not a product screen', () => {
    const page = read('app/dev/stockfish-uci.tsx');
    assert.match(page, /IS_DEV/);
    assert.match(page, /Redirect/);
    assert.match(page, /runUciSmokeTest/);
    assert.match(page, /createUciTransport/);
    const home = read('app/index.tsx');
    assert.doesNotMatch(home, /stockfish-uci/);
  });

  it('does not wire native Stockfish into product engine factories', () => {
    const opponent = read('lib/engines/index.ts');
    assert.match(opponent, /return randomEngine/);
    assert.match(opponent, /Platform\.OS === 'web'/);
    const analysisNative = read('lib/engines/analysis/createChessEngineService.ts');
    assert.doesNotMatch(analysisNative, /createNativeUciTransport|StockfishUci/);
    const notes = read('lib/engines/analysis/types.ts');
    assert.match(notes, /android:\s*\{[\s\S]*available:\s*false/);
  });
});
