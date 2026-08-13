/**
 * Brand toggle assets wired into shared UI controls.
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

describe('BrandAssets toggle icon map', () => {
  it('maps board, coordinates, and speaker to the PNG files on disk', () => {
    const assets = read('constants/BrandAssets.ts');
    assert.match(assets, /board:\s*\{[\s\S]*?on: require\('@\/assets\/brand\/toggles\/Board-ON\.png'\)/);
    assert.match(assets, /board:\s*\{[\s\S]*?off: require\('@\/assets\/brand\/toggles\/Board-OFF\.png'\)/);
    assert.match(assets, /coordinates:\s*\{[\s\S]*?on: require\('@\/assets\/brand\/toggles\/Coordonnee-ON\.png'\)/);
    assert.match(assets, /coordinates:\s*\{[\s\S]*?off: require\('@\/assets\/brand\/toggles\/Coordonnee-OFF\.png'\)/);
    assert.match(assets, /speaker:\s*\{[\s\S]*?on: require\('@\/assets\/brand\/toggles\/SPEAKER ON\.png'\)/);
    assert.match(assets, /speaker:\s*\{[\s\S]*?off: require\('@\/assets\/brand\/toggles\/SPEAKER OFF\.png'\)/);
  });
});

describe('shared brand toggle components', () => {
  it('BoardVisibilityToggle uses board on/off without Ionicons', () => {
    const src = read('components/BoardVisibilityToggle.tsx');
    assert.match(src, /BrandAssets\.toggles\.board\.on/);
    assert.match(src, /BrandAssets\.toggles\.board\.off/);
    assert.match(src, /BrandAssetToggle/);
    assert.doesNotMatch(src, /Ionicons/);
    assert.doesNotMatch(src, /eye-outline/);
  });

  it('BoardCoordinatesToggle uses coordinates on/off without Ionicons', () => {
    const src = read('components/BoardCoordinatesToggle.tsx');
    assert.match(src, /BrandAssets\.toggles\.coordinates\.on/);
    assert.match(src, /BrandAssets\.toggles\.coordinates\.off/);
    assert.match(src, /BrandAssetToggle/);
    assert.doesNotMatch(src, /Ionicons/);
    assert.doesNotMatch(src, /grid-outline/);
  });

  it('SoundToggle uses speaker on/off (not mic) without colored chrome', () => {
    const src = read('components/SoundToggle.tsx');
    assert.match(src, /BrandAssets\.toggles\.speaker\.on/);
    assert.match(src, /BrandAssets\.toggles\.speaker\.off/);
    assert.match(src, /BrandAssetToggle/);
    assert.match(src, /toggleVoice/);
    assert.doesNotMatch(src, /micOn|micOff/);
    assert.doesNotMatch(src, /Ionicons/);
    assert.doesNotMatch(src, /colors\.primary/);
  });

  it('BrandAssetToggle renders images with contain and no tint', () => {
    const src = read('components/BrandAssetToggle.tsx');
    assert.match(src, /resizeMode="contain"/);
    assert.doesNotMatch(src, /tintColor/);
    assert.doesNotMatch(src, /backgroundColor/);
  });
});
