/**
 * Exercise HubModeCard mascots — shared BrandAssets.exercises mapping.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');
const modesDir = join(mobileRoot, 'assets/brand/modes');

const EXPECTED_FILES = [
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

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('exercise hub mascot assets', () => {
  it('ships all ten user-provided mode PNGs (unchanged filenames)', () => {
    for (const name of EXPECTED_FILES) {
      const full = join(modesDir, name);
      assert.ok(existsSync(full), `missing ${name}`);
      assert.ok(readFileSync(full).length > 10_000, `${name} looks empty`);
    }
  });

  it('maps every exercise through BrandAssets.exercises (no per-screen requires)', () => {
    const brand = read('constants/BrandAssets.ts');
    assert.match(brand, /exercises:\s*\{/);
    for (const key of [
      'construisOuverture',
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
    for (const name of EXPECTED_FILES) {
      assert.ok(brand.includes(name), `BrandAssets missing require for ${name}`);
    }
  });

  it('wires hubs to BrandAssets.exercises (not Ionicons / old mode thumbnails)', () => {
    const vision = read('app/visualisation/index.tsx');
    assert.match(vision, /BrandAssets\.exercises\.suiviMental/);
    assert.match(vision, /BrandAssets\.exercises\.nommerLeCoup/);
    assert.match(vision, /BrandAssets\.exercises\.jouerLeCoup/);
    assert.doesNotMatch(vision, /BrandAssets\.modes\.(visualisation|target|classic)/);

    const culture = read('app/quiz-ouverture/index.tsx');
    assert.match(culture, /BrandAssets\.exercises\.quelleOuverture/);
    assert.match(culture, /BrandAssets\.exercises\.construisOuverture/);
    assert.match(culture, /BrandAssets\.exercises\.quiz/);
    assert.doesNotMatch(culture, /BrandAssets\.modes/);

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
    assert.match(card, /modeIcon:\s*\{\s*width:\s*40,\s*height:\s*40\s*\}/);
    // Ionicons path may use secondary fill; brand `icon` path must not.
    assert.match(
      card,
      /\{icon \? \([\s\S]*?<View style=\{styles\.iconWrap\}>[\s\S]*?\) : iconName \? \([\s\S]*?backgroundColor:\s*colors\.secondary/,
    );
  });

  it('does not treat the Jouer le coup (2) duplicate as the mapped asset', () => {
    const brand = read('constants/BrandAssets.ts');
    assert.doesNotMatch(brand, /Jouer le coup \(2\)/);
    assert.ok(readdirSync(modesDir).includes('Jouer le coup.png'));
  });
});
