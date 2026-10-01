/**
 * Launch intro + home logo wiring (source contracts).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('launch intro and home logo wiring', () => {
  it('uses the supplied full-resolution PNGs, not the 512px home WebP', () => {
    const assets = read('constants/BrandAssets.ts');
    assert.match(assets, /splash: require\('@\/assets\/brand\/launch-portrait\.png'\)/);
    assert.match(assets, /horizontalLogo: require\('@\/assets\/brand\/home-horizontal-logo\.png'\)/);
    assert.doesNotMatch(assets, /v1-anychess-horizontal-logo\.webp/);
    assert.doesNotMatch(assets, /splash-brand\.png/);
  });

  it('fades the complete launch artwork as one image after it has loaded', () => {
    const splash = read('components/AnyChessSplashScreen.tsx');
    assert.match(splash, /BrandAssets\.splash/);
    assert.match(splash, /onLoadEnd/);
    assert.match(splash, /setIntroStartedAtMs/);
    assert.match(splash, /ENTER_FADE_DURATION_MS/);
    assert.doesNotMatch(splash, /WORDMARK_FADE/);
    assert.doesNotMatch(splash, /TAGLINE_FADE/);
    assert.doesNotMatch(splash, /anychess-splash-tagline/);
    assert.doesNotMatch(splash, /BrandAssets\.logoMark/);
  });

  it('mounts the intro only in the root shell and prepares home + nav underneath', () => {
    const layout = read('app/_layout.tsx');
    const home = read('app/index.tsx');
    assert.match(layout, /AnyChessSplashScreen/);
    assert.match(layout, /\{appReady \? <BottomNavigation \/> : null\}/);
    assert.match(layout, /paddingBottom: DesignTokens\.bottomNavContentHeight/);
    assert.doesNotMatch(home, /AnyChessSplashScreen/);
    assert.match(home, /BrandAssets\.horizontalLogo/);
    assert.match(home, /HORIZONTAL_LOGO_ART/);
    assert.doesNotMatch(home, /HORIZONTAL_LOGO_WORDMARK/);
    assert.doesNotMatch(home, /home-tagline/);
    assert.match(home, /home\.tagline/);
  });
});
