import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const display = path.join(root, 'assets', 'brand', 'display');

const HOME_DISPLAY = [
  'v1-anychess-horizontal-logo.webp',
  'nav/v1-home-nav.webp',
  'mascots/V1-mascot-classic-knight-soundwave.webp',
  'mascots/V1-mascot-openings-knight-reading.webp',
  'mascots/v1-mascot-blind-knight-blindfold.webp',
  'mascots/v1-mascot-tactics-knight-calculator.webp',
  'mascots/v1-mascot-visualisation-knight-binoculars.webp',
  'mascots/V1-mascot-quiz-knight-detective.webp',
  'mascots/mascot-player-knight-dj.webp',
];

describe('optimized home brand display assets', () => {
  it('ships lightweight WebP copies for logo, nav, and every ModeCard mascot', () => {
    for (const rel of HOME_DISPLAY) {
      const full = path.join(display, rel);
      assert.ok(fs.existsSync(full), `missing ${rel}`);
      const kb = fs.statSync(full).size / 1024;
      assert.ok(kb > 1, `${rel} looks empty`);
      assert.ok(kb < 80, `${rel} is unexpectedly large (${kb.toFixed(1)}KB)`);
    }
  });
});
