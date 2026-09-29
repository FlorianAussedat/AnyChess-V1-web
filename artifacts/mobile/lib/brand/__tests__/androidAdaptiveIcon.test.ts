import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { ANYCHESS_NAVY } from '../splashTiming.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readPng(rel: string) {
  const full = path.join(root, rel);
  assert.ok(fs.existsSync(full), `missing ${rel}`);
  const buf = fs.readFileSync(full);
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  return { full, buf };
}

describe('Android adaptive launcher icon', () => {
  it('ships 1024² RGBA foreground and monochrome marks', () => {
    for (const rel of [
      'assets/icon/android-adaptive-foreground.png',
      'assets/icon/android-adaptive-monochrome.png',
    ]) {
      const { buf } = readPng(rel);
      assert.equal(buf.readUInt32BE(16), 1024, `${rel} width`);
      assert.equal(buf.readUInt32BE(20), 1024, `${rel} height`);
      const colorType = buf[25];
      assert.equal(colorType, 6, `${rel} must be RGBA (PNG color type 6)`);
    }
  });

  it('wires Expo adaptiveIcon to navy #0B1728 without replacing splash icon', () => {
    const app = JSON.parse(
      fs.readFileSync(path.join(root, 'app.json'), 'utf8'),
    ) as {
      expo: {
        icon: string;
        splash: { image: string; backgroundColor: string };
        android: {
          package: string;
          adaptiveIcon: {
            foregroundImage: string;
            backgroundColor: string;
            monochromeImage: string;
          };
        };
      };
    };
    assert.equal(app.expo.android.package, 'com.anychess.app');
    assert.equal(app.expo.icon, './assets/images/icon.png');
    assert.equal(app.expo.splash.image, './assets/images/icon.png');
    assert.equal(app.expo.android.adaptiveIcon.foregroundImage, './assets/icon/android-adaptive-foreground.png');
    assert.equal(app.expo.android.adaptiveIcon.monochromeImage, './assets/icon/android-adaptive-monochrome.png');
    assert.equal(app.expo.android.adaptiveIcon.backgroundColor, ANYCHESS_NAVY);
    assert.equal(ANYCHESS_NAVY, '#0B1728');
  });
});
