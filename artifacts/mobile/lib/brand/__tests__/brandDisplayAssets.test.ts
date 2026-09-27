import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HORIZONTAL_LOGO_ART,
  HORIZONTAL_LOGO_CANVAS,
  LAUNCH_PORTRAIT_ART,
  LAUNCH_PORTRAIT_CANVAS,
} from '../../../constants/brandArtBounds.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const display = path.join(root, 'assets', 'brand', 'display');

const HOME_DISPLAY = [
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
  it('ships the supplied full-resolution logo and portrait for launch', () => {
    for (const [name, width, height] of [
      ['home-horizontal-logo.png', HORIZONTAL_LOGO_CANVAS.width, HORIZONTAL_LOGO_CANVAS.height],
      ['launch-portrait.png', LAUNCH_PORTRAIT_CANVAS.width, LAUNCH_PORTRAIT_CANVAS.height],
    ] as const) {
      const png = fs.readFileSync(path.join(root, 'assets', 'brand', name));
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), width);
      assert.equal(png.readUInt32BE(20), height);
    }
  });

  it('crops the home logo so the knight, wordmark, and full tagline stay visible', () => {
    assert.ok(HORIZONTAL_LOGO_ART.bottom >= 591 / 1024);
    assert.ok(HORIZONTAL_LOGO_ART.top <= 347 / 1024);
    assert.ok(HORIZONTAL_LOGO_ART.right - HORIZONTAL_LOGO_ART.left > 0.5);
    assert.ok(LAUNCH_PORTRAIT_ART.bottom >= 805 / 1024);
  });

  it('ships lightweight WebP copies for nav and every ModeCard mascot', () => {
    for (const rel of HOME_DISPLAY) {
      const full = path.join(display, rel);
      assert.ok(fs.existsSync(full), `missing ${rel}`);
      const kb = fs.statSync(full).size / 1024;
      assert.ok(kb > 1, `${rel} looks empty`);
      assert.ok(kb < 80, `${rel} is unexpectedly large (${kb.toFixed(1)}KB)`);
    }
  });
});
