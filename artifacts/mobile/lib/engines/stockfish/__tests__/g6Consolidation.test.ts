/**
 * G6 consolidation: licence, ABI pin, DEV harness, web isolation.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('G6 licence and provenance', () => {
  it('keeps GPL-3.0 text, AUTHORS, NOTICE, and the sf_19 pin', () => {
    const copying = join(mobileRoot, 'modules/stockfish-uci/vendor/stockfish/Copying.txt');
    const authors = join(mobileRoot, 'modules/stockfish-uci/vendor/stockfish/AUTHORS');
    const notice = join(mobileRoot, 'modules/stockfish-uci/NOTICE.md');
    assert.ok(existsSync(copying), 'Copying.txt');
    assert.ok(existsSync(authors), 'AUTHORS');
    assert.ok(existsSync(notice), 'NOTICE.md');
    assert.match(readFileSync(copying, 'utf8'), /GNU GENERAL PUBLIC LICENSE/);
    assert.match(readFileSync(copying, 'utf8'), /Version 3/);
    assert.match(readFileSync(authors, 'utf8'), /Tord Romstad/);
    const noticeText = readFileSync(notice, 'utf8');
    assert.match(noticeText, /GPL-3\.0-or-later/);
    assert.match(noticeText, /official-stockfish\/Stockfish\/tree\/sf_19/);
    const manifest = JSON.parse(
      read('modules/stockfish-uci/scripts/stockfish-android-manifest.json'),
    );
    assert.equal(manifest.version, '19');
    assert.equal(manifest.tag, 'sf_19');
    assert.equal(manifest.license, 'GPL-3.0-or-later');
    assert.deepEqual(manifest.abi, ['arm64-v8a']);
    assert.equal(
      manifest.artifact.sha256,
      'ebb24051aa4a222b4daaf049b882ecf1163d370c128fe02316602643f4d5e426',
    );
  });
});

describe('G6 ABI', () => {
  it('documents arm64-v8a only and fails other ABIs in Kotlin before spawn', () => {
    const kt = read(
      'modules/stockfish-uci/android/src/main/java/expo/modules/stockfishuci/StockfishUciModule.kt',
    );
    assert.match(kt, /arm64-v8a only/);
    assert.match(kt, /SUPPORTED_ABIS/);
    assert.doesNotMatch(kt, /armeabi-v7a\/libstockfish/);
    const fetch = read('modules/stockfish-uci/scripts/fetch-android-binary.mjs');
    assert.match(fetch, /jniLibs\/arm64-v8a/);
    assert.doesNotMatch(fetch, /armeabi-v7a/);
  });
});

describe('G6 DEV harness', () => {
  it('is __DEV__-gated, redirected in production, and off product nav', () => {
    const page = read('app/dev/stockfish-uci.tsx');
    assert.match(page, /IS_DEV/);
    assert.match(page, /Redirect/);
    const layout = read('app/_layout.tsx');
    assert.match(layout, /__DEV__/);
    assert.match(layout, /dev\/stockfish-uci/);
    const home = read('app/index.tsx');
    assert.doesNotMatch(home, /stockfish-uci/);
  });
});

describe('G6 web isolation', () => {
  it('keeps Worker WASM factory and transport free of StockfishUci', () => {
    const webFactory = read('lib/engines/analysis/createChessEngineService.web.ts');
    assert.match(webFactory, /createWebUciTransport/);
    assert.match(webFactory, /getStockfishWorkerUrl/);
    assert.doesNotMatch(webFactory, /StockfishUci/);
    const web = read('lib/engines/stockfish/transport.web.ts');
    assert.match(web, /new Worker\(enginePath\)/);
    assert.doesNotMatch(web, /StockfishUci|ProcessBuilder|libstockfish/);
    const profiles = read('lib/analysis/profiles.ts');
    assert.match(profiles, /depth: 12, movetimeMs: 250/);
    assert.match(profiles, /depth: 16, movetimeMs: 800/);
    assert.match(profiles, /depth: 20, movetimeMs: 2500/);
  });
});

describe('G6 canonical doc', () => {
  it('exists at NATIVE_STOCKFISH_ANDROID.md', () => {
    const doc = read('NATIVE_STOCKFISH_ANDROID.md');
    assert.match(doc, /arm64-v8a/);
    assert.match(doc, /GPL-3\.0-or-later/);
    assert.match(doc, /\/dev\/stockfish-uci/);
    assert.match(doc, /transport\.web\.ts/);
  });
});
