import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { DesignTokens } from '../../../constants/designTokens.ts';
import * as mascotCatalog from '../../profile/mascotCatalog.ts';
import { MAIN_MODE_CARD_META } from '../../app/mainModeCards.ts';
const mobile = new URL('../../../', import.meta.url);
function bundledModule(relative: string): any {
  const source = readFileSync(new URL(relative, mobile), 'utf8');
  const code = transformSync(source, { loader: 'ts', format: 'cjs' }).code;
  const module = { exports: {} as any };
  runInNewContext(code, {
    module,
    require(id: string) {
      if (id === '@/lib/profile/mascotCatalog') return mascotCatalog;
      assert.ok(id.startsWith('@/assets/'));
      assert.ok(existsSync(new URL(id.slice(2), mobile)), `missing asset ${id}`);
      return id;
    },
  });
  return module.exports;
}
describe('release brand asset and route integrity', () => {
  it('resolves all centralized assets and keeps seven optimized official home mascots', () => {
    const { BrandAssets, modeCardIllustration } = bundledModule('constants/BrandAssets.ts');
    assert.equal(Object.keys(BrandAssets.mascots).length, 7);
    assert.equal(BrandAssets.difficulty, undefined);
    for (const mode of MAIN_MODE_CARD_META) {
      assert.match(modeCardIllustration(mode.id), /assets\/brand\/display\/mascots\/.*\.webp$/);
      const route = mode.route.slice(1);
      assert.ok(
        existsSync(new URL(`app/${route}.tsx`, mobile)) ||
          existsSync(new URL(`app/${route}/index.tsx`, mobile)),
        `missing route ${mode.route}`,
      );
    }
    assert.match(BrandAssets.splash, /launch-portrait\.png$/);
    assert.match(BrandAssets.horizontalLogo, /home-horizontal-logo\.png$/);
  });
  it('keeps all eleven stable offline mascot avatars backed by official images', () => {
    const { mascotImage } = bundledModule('components/profile/mascotImages.ts');
    const catalog = readFileSync(new URL('lib/profile/mascotCatalog.ts', mobile), 'utf8');
    const ids = [...catalog.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
    assert.equal(ids.length, 11);
    for (const id of ids) assert.match(mascotImage(id), /assets\/brand\/mascots\/.*\.png$/);
    assert.equal(mascotImage('unknown-avatar'), null);
  });
});

function luminance(hex: string): number {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
it('keeps secondary text readable at WCAG AA normal-text contrast on shared surfaces', () => {
  const colors = DesignTokens.color;
  for (const background of [colors.background, colors.card, colors.secondary]) {
    assert.ok((luminance(colors.mutedForeground) + 0.05) / (luminance(background) + 0.05) >= 4.5);
  }
});

it('keeps all French/English dictionary keys and substitution variables aligned', () => {
  const source = readFileSync(new URL('lib/i18n/messages.ts', mobile), 'utf8');
  const module = { exports: {} as any };
  // Expose dictionaries only in this isolated evaluation, never in the shipped bundle.
  const code = transformSync(source + '\nexport { fr, en };', { loader: 'ts', format: 'cjs' }).code;
  runInNewContext(code, { module });
  const { fr, en } = module.exports;
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  const params = (text: string) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(fr)) {
    assert.ok(fr[key].trim() && en[key].trim(), key);
    assert.deepEqual(params(fr[key]), params(en[key]), key);
  }
});
