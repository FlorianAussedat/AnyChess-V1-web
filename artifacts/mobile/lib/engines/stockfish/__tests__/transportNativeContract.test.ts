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
    assert.match(page, /diagnose/);
    const home = read('app/index.tsx');
    assert.doesNotMatch(home, /stockfish-uci/);
  });

  it('G1 execs extracted jniLib from nativeLibraryDir, not filesDir', () => {
    const kt = read(
      'modules/stockfish-uci/android/src/main/java/expo/modules/stockfishuci/StockfishUciModule.kt',
    );
    assert.match(kt, /nativeLibraryDir/);
    assert.match(kt, /libstockfish\.so/);
    assert.match(kt, /arm64-v8a only/);
    assert.match(kt, /diagnoseBinary/);
    assert.match(kt, /FLAG_EXTRACT_NATIVE_LIBS/);
    assert.match(kt, /setExecutable\(true, false\)/);
    assert.doesNotMatch(kt, /stockfish\.sfbin/);
    assert.doesNotMatch(kt, /FileOutputStream/);
    const fetch = read('modules/stockfish-uci/scripts/fetch-android-binary.mjs');
    assert.match(fetch, /jniLibs\/arm64-v8a/);
    assert.match(fetch, /libstockfish\.so/);
    assert.match(fetch, /removeLegacyAssets/);
    const plugin = read('modules/stockfish-uci/app.plugin.js');
    assert.match(plugin, /useLegacyPackaging/);
    assert.match(plugin, /extractNativeLibs/);
    assert.match(plugin, /libstockfish\.so/);
  });

  it('G4 SharedStockfishRuntime boots on Android without RandomEngine', () => {
    const runtime = read('lib/engines/runtime/SharedStockfishRuntime.ts');
    assert.match(runtime, /isSharedRuntimeSupported|Platform\.OS === 'android'/);
    assert.match(runtime, /new StockfishAnalysisService/);
    assert.doesNotMatch(runtime, /RandomEngine/);
    assert.doesNotMatch(runtime, /Stockfish unavailable on native/);
  });

  it('G2 AnyLyseur factory binds native UciTransport on Android', () => {
    const analysisNative = read('lib/engines/analysis/createChessEngineService.ts');
    assert.match(analysisNative, /createUciTransport/);
    assert.match(analysisNative, /Platform\.OS === 'android'/);
    const notes = read('lib/engines/analysis/types.ts');
    assert.match(notes, /android:\s*\{[\s\S]*available:\s*true/);
  });

  it('G5 AppState recover reboots ChessEngineService and StockfishEngine', () => {
    const service = read('lib/engines/analysis/ChessEngineService.ts');
    assert.match(service, /subscribeAndroidAppState/);
    assert.match(service, /recoverAfterBackground/);
    const play = read('lib/engines/stockfish/StockfishEngine.ts');
    assert.match(play, /subscribeAndroidAppState/);
    assert.match(play, /recoverAfterBackground/);
    const helper = read('lib/engines/stockfish/androidAppState.ts');
    assert.match(helper, /Platform\?\.OS !== 'android'/);
    assert.doesNotMatch(read('lib/engines/stockfish/transport.web.ts'), /recoverAfterBackground/);
  });
});
