/**
 * Shared voice toggle uses brand mic-on / mic-off assets.
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

describe('SoundToggle brand mic icons', () => {
  it('uses micOn / micOff assets with orange/blue backgrounds', () => {
    const src = read('components/SoundToggle.tsx');
    assert.match(src, /BrandAssets\.toggles\.micOn/);
    assert.match(src, /BrandAssets\.toggles\.micOff/);
    assert.match(src, /resizeMode="contain"/);
    assert.match(src, /voiceEnabled \? colors\.primary : colors\.card/);
    assert.match(src, /testID="sound-toggle"/);
    assert.match(src, /toggleVoice/);
    assert.doesNotMatch(src, /Ionicons/);
    assert.doesNotMatch(src, /person-circle/);
  });

  it('BrandAssets maps mic toggles to the expected PNG paths', () => {
    const assets = read('constants/BrandAssets.ts');
    assert.match(assets, /micOn: require\('@\/assets\/brand\/toggles\/mic-on\.png'\)/);
    assert.match(assets, /micOff: require\('@\/assets\/brand\/toggles\/mic-off\.png'\)/);
  });

  it('ScreenHeader still mounts the shared SoundToggle', () => {
    const header = read('components/ScreenHeader.tsx');
    assert.match(header, /SoundToggle/);
    assert.match(header, /showSound/);
  });
});
