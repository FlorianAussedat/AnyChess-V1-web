/**
 * G2 native analysis factory wiring (static contract).
 * Does not boot Stockfish — device recipe covers the real process.
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

describe('G2 AnyLyseur native factory wiring', () => {
  it('Android createChessEngineService injects the G1 UciTransport', () => {
    const native = read('lib/engines/analysis/createChessEngineService.ts');
    assert.match(native, /from '\.\.\/stockfish\/transport'/);
    assert.match(native, /createUciTransport/);
    assert.match(native, /Platform\.OS === 'android'/);
    assert.match(native, /createTransport/);
    assert.doesNotMatch(native, /return randomEngine/);
    assert.doesNotMatch(native, /new Worker/);
  });

  it('web factory still binds the WASM Worker and has no native module', () => {
    const web = read('lib/engines/analysis/createChessEngineService.web.ts');
    assert.match(web, /createWebUciTransport/);
    assert.match(web, /getStockfishWorkerUrl/);
    assert.doesNotMatch(web, /StockfishUci/);
    assert.doesNotMatch(web, /createNativeUciTransport/);
    assert.doesNotMatch(web, /RandomEngine/);
    const webTransport = read('lib/engines/stockfish/transport.web.ts');
    assert.match(webTransport, /new Worker\(enginePath\)/);
    assert.doesNotMatch(webTransport, /StockfishUci/);
  });

  it('AnyLyseur still goes through AnalysisController → StockfishChessEngine → factory', () => {
    const hook = read('lib/analysis/useAnyLyseurAnalysis.ts');
    assert.match(hook, /createChessEngine\(\)/);
    assert.match(hook, /new AnalysisController/);
    const factory = read('lib/analysis/engine/createChessEngine.ts');
    assert.match(factory, /createStockfishChessEngine/);
    const adapter = read('lib/analysis/engine/StockfishChessEngine.ts');
    assert.match(adapter, /createChessEngineService\(\)/);
    assert.match(adapter, /this\.service\.analyzePosition/);
    assert.match(adapter, /this\.service\.destroy/);
  });

  it('G4 endgames share SharedStockfishRuntime, not a new engine stack', () => {
    const opponent = read('lib/engines/index.ts');
    assert.match(opponent, /withInitFallback\(new StockfishEngine/);
    const runtime = read('lib/engines/runtime/SharedStockfishRuntime.ts');
    assert.match(runtime, /Platform\.OS === 'android'/);
    assert.match(runtime, /new StockfishAnalysisService/);
    assert.doesNotMatch(runtime, /Stockfish unavailable on native/);
  });

  it('G5 AnyLyseur Android depth caps keep web movetimes', () => {
    const profiles = read('lib/analysis/profiles.ts');
    assert.match(profiles, /ANDROID_ANALYSIS_DEPTH_CAP/);
    assert.match(profiles, /resolveAnalysisProfile/);
    assert.match(profiles, /platform === 'android'/);
    assert.match(profiles, /movetimeMs: 250/);
    assert.match(profiles, /movetimeMs: 800/);
    assert.match(profiles, /movetimeMs: 2500/);
  });
});
