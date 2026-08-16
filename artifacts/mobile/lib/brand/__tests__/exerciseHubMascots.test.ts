/**
 * Exercise HubModeCard mascots — shared BrandAssets.exercises mapping.
 * Runtime assets are lightweight display WebPs; source PNGs stay untouched.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');
const modesDir = join(mobileRoot, 'assets/brand/modes');
const displayModesDir = join(mobileRoot, 'assets/brand/display/modes');

const SOURCE_PNGS = [
  'Construis l’ouverture.png',
  'Ecouter puis reconstruire.png',
  'Problemes Visuels.png',
  'Quiz.png',
  'Suivi mental de position.png',
  'Jouer le coup.png',
  'Regarder puis réciter.png',
  "Problemes a l'aveugle.png",
  'Nommer le coup.png',
  'Quelle ouverture.png',
] as const;

const DISPLAY_WEBPS = [
  'construis-ouverture.webp',
  'ecouter-puis-reconstruire.webp',
  'problemes-visuels.webp',
  'quiz.webp',
  'suivi-mental-de-position.webp',
  'jouer-le-coup.webp',
  'regarder-puis-reciter.webp',
  'problemes-a-l-aveugle.webp',
  'nommer-le-coup.webp',
  'quelle-ouverture.webp',
] as const;

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('exercise hub mascot assets', () => {
  it('keeps all ten user-provided source PNGs (untouched originals)', () => {
    for (const name of SOURCE_PNGS) {
      const full = join(modesDir, name);
      assert.ok(existsSync(full), `missing ${name}`);
      assert.ok(statSync(full).size > 10_000, `${name} looks empty`);
    }
  });

  it('ships lightweight display WebPs under 40KB each', () => {
    for (const name of DISPLAY_WEBPS) {
      const full = join(displayModesDir, name);
      assert.ok(existsSync(full), `missing display ${name}`);
      const kb = statSync(full).size / 1024;
      assert.ok(kb > 1, `${name} looks empty`);
      assert.ok(kb < 40, `${name} is unexpectedly large (${kb.toFixed(1)}KB)`);
    }
  });

  it('maps every exercise through BrandAssets.exercises display WebPs', () => {
    const brand = read('constants/BrandAssets.ts');
    assert.match(brand, /exercises:\s*\{/);
    for (const key of [
      'construisOuverture',
      'defendsNulle',
      'ecouterPuisReconstruire',
      'problemesVisuels',
      'quiz',
      'suiviMental',
      'jouerLeCoup',
      'regarderPuisReciter',
      'problemesAveugle',
      'nommerLeCoup',
      'quelleOuverture',
    ]) {
      assert.match(brand, new RegExp(`${key}:\\s*require\\(`));
    }
    for (const name of DISPLAY_WEBPS) {
      assert.ok(
        brand.includes(`display/modes/${name}`),
        `BrandAssets missing display require for ${name}`,
      );
    }
    assert.doesNotMatch(brand, /exercises:[\s\S]*?require\('@\/assets\/brand\/modes\//);
  });

  it('wires hubs to BrandAssets.exercises (not Ionicons / old mode thumbnails)', () => {
    const vision = read('app/visualisation/index.tsx');
    assert.match(vision, /BrandAssets\.exercises\.suiviMental/);
    assert.match(vision, /BrandAssets\.exercises\.nommerLeCoup/);
    assert.match(vision, /BrandAssets\.exercises\.jouerLeCoup/);
    assert.doesNotMatch(vision, /BrandAssets\.modes\.(visualisation|target|classic)/);

    const culture = read('app/quiz-ouverture/index.tsx');
    assert.match(culture, /BrandAssets\.exercises\.quelleOuverture/);
    assert.match(culture, /BrandAssets\.exercises\.defendsNulle/);
    assert.match(culture, /BrandAssets\.exercises\.quiz/);
    assert.doesNotMatch(culture, /BrandAssets\.modes/);
    assert.doesNotMatch(culture, /construisOuverture/);

    const blind = read('components/blind/BlindHubPhase.tsx');
    assert.match(blind, /BrandAssets\.exercises\.ecouterPuisReconstruire/);
    assert.match(blind, /BrandAssets\.exercises\.regarderPuisReciter/);
    assert.doesNotMatch(blind, /iconName=/);

    const puzzles = read('components/puzzles/PuzzleHubPhase.tsx');
    assert.match(puzzles, /BrandAssets\.exercises\.problemesVisuels/);
    assert.match(puzzles, /BrandAssets\.exercises\.problemesAveugle/);
    assert.doesNotMatch(puzzles, /iconName=/);
  });

  it('HubModeCard keeps contain sizing and no fill behind brand icons', () => {
    const card = read('components/HubModeCard.tsx');
    assert.match(card, /resizeMode=\"contain\"/);
    assert.match(card, /modeIcon:\s*\{\s*width:\s*80,\s*height:\s*80\s*\}/);
    assert.match(card, /iconWrap:\s*\{[\s\S]*?width:\s*88,[\s\S]*?height:\s*88,/);
    assert.match(
      card,
      /\{icon \? \([\s\S]*?<View style=\{styles\.iconWrap\}>[\s\S]*?\) : iconName \? \([\s\S]*?backgroundColor:\s*colors\.secondary/,
    );
  });

  it('does not treat the Jouer le coup (2) duplicate as the mapped asset', () => {
    const brand = read('constants/BrandAssets.ts');
    const script = read('scripts/optimize-brand-display-assets.mjs');
    assert.doesNotMatch(brand, /Jouer le coup \(2\)/);
    assert.doesNotMatch(script, /Jouer le coup \(2\)/);
    assert.ok(readdirSync(modesDir).includes('Jouer le coup.png'));
  });
});
