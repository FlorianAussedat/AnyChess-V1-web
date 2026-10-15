import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import jpeg from 'jpeg-js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { setCloudTransferReadersForTests } from '../../cloud/syncTransport.ts';
import {
  cropAndFitRgba,
  decodeAvatarBytes,
  prepareAvatarBytes,
} from '../avatarRaster.ts';
import {
  avatarCropRoute,
  avatarPreviewLayout,
  bytesToDataUrl,
  zoomFromTrack,
} from '../avatarImage.ts';
import { commitAvatarChange } from '../avatarRemote.ts';
import { readAvatarCache, readPendingAvatar, writeAvatarCache } from '../avatarLocal.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function rgba(width: number, height: number, paint: (x: number, y: number) => number[]): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const px = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = px[0] ?? 0;
      data[i + 1] = px[1] ?? 0;
      data[i + 2] = px[2] ?? 0;
      data[i + 3] = px[3] ?? 255;
    }
  }
  return data;
}

function jpegBytes(width: number, height: number): Uint8Array {
  const encoded = jpeg.encode(
    { data: rgba(width, height, () => [20, 40, 200, 255]), width, height },
    80,
  );
  return encoded.data;
}

describe('avatar crop without the native manipulator', () => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    setCloudTransferReadersForTests({ transport: null, wifiOnly: null });
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  });

  it('crops a JPEG and a PNG down to a PNG and rejects other bytes', () => {
    const jpeg = jpegBytes(8, 4);
    const prepared = prepareAvatarBytes(jpeg, 1);
    assert.ok(prepared);
    assert.equal(prepared?.mime, 'image/png');
    assert.equal(prepared?.bytes[0], 0x89);
    assert.equal(prepared?.bytes[1], 0x50);
    const decoded = decodeAvatarBytes(prepared!.bytes);
    assert.ok(decoded);
    assert.ok((decoded?.width ?? 0) <= 512);
    assert.ok((decoded?.height ?? 0) <= 512);

    const png = prepareAvatarBytes(prepared!.bytes, 2);
    assert.equal(png?.mime, 'image/png');
    assert.equal(prepareAvatarBytes(new Uint8Array([1, 2, 3, 4])), null);

    const fitted = cropAndFitRgba(
      { data: rgba(4, 2, (x) => [x * 40, 0, 0, 255]), width: 4, height: 2 },
      1,
      2,
    );
    assert.equal(fitted.width, 2);
    assert.equal(fitted.height, 2);
  });

  it('keeps the new local photo when the upload fails and defers on cellular', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
    const storage = new MemoryKeyValueStorage();
    const previous = bytesToDataUrl(new Uint8Array([1, 2, 3]), 'image/png');
    const next = bytesToDataUrl(jpegBytes(4, 4), 'image/jpeg');
    await writeAvatarCache(storage, 'user-1', previous);
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => true,
    });
    let calls = 0;
    const failed = await commitAvatarChange({
      storage,
      userId: 'user-1',
      email: 'ada@example.com',
      accessToken: 'token',
      dataUrl: next,
      fetchImpl: (async () => {
        calls += 1;
        return { ok: false, status: 500 } as Response;
      }) as typeof fetch,
    });
    assert.equal(failed, 'sync_failed');
    assert.equal(calls, 1);
    assert.equal(await readAvatarCache(storage, 'user-1'), next);
    assert.equal((await readPendingAvatar(storage))?.intent, 'upload');
    assert.equal((await readPendingAvatar(storage))?.dataUrl, next);

    setCloudTransferReadersForTests({
      transport: async () => 'cellular',
      wifiOnly: async () => true,
    });
    const waiting = await commitAvatarChange({
      storage,
      userId: 'user-1',
      email: 'ada@example.com',
      accessToken: 'token',
      dataUrl: next,
      fetchImpl: (async () => {
        throw new Error('must not upload on cellular');
      }) as typeof fetch,
    });
    assert.equal(waiting, 'waiting_wifi');
    assert.equal(await readAvatarCache(storage, 'user-1'), next);
    assert.equal((await readPendingAvatar(storage))?.intent, 'upload');
  });

  it('matches the preview to the saved crop for portrait, landscape, and square', () => {
    const cases = [
      { width: 300, height: 600, zoom: 2 },
      { width: 640, height: 360, zoom: 1.5 },
      { width: 400, height: 400, zoom: 1 },
      { width: 400, height: 400, zoom: 3 },
    ];
    for (const sample of cases) {
      const layout = avatarPreviewLayout({
        imageWidth: sample.width,
        imageHeight: sample.height,
        maxWidth: 280,
        maxHeight: 220,
        zoom: sample.zoom,
      });
      const side = Math.min(sample.width, sample.height) / sample.zoom;
      assert.equal(layout.scale, sample.zoom);
      assert.equal(layout.frameWidth, 220);
      assert.equal(layout.frameHeight, 220);
      assert.equal(layout.crop.width, side);
      assert.equal(layout.crop.height, side);
      assert.equal(layout.crop.x, (sample.width - side) / 2);
      assert.equal(layout.crop.y, (sample.height - side) / 2);
      const cover = Math.max(220 / sample.width, 220 / sample.height);
      assert.ok(layout.imageWidth >= 220 - 0.01);
      assert.ok(layout.imageHeight >= 220 - 0.01);
      assert.ok(Math.abs(layout.imageWidth - sample.width * cover) < 0.01);
      assert.ok(Math.abs(layout.imageHeight - sample.height * cover) < 0.01);
      const painted = cropAndFitRgba(
        {
          data: rgba(sample.width, sample.height, (x, y) => {
            const center =
              x >= layout.crop.x &&
              x < layout.crop.x + layout.crop.width &&
              y >= layout.crop.y &&
              y < layout.crop.y + layout.crop.height;
            return center ? [0, 0, 255, 255] : [255, 0, 0, 255];
          }),
          width: sample.width,
          height: sample.height,
        },
        sample.zoom,
        32,
      );
      assert.equal(painted.data[2], 255);
      assert.equal(painted.data[0], 0);
    }
    assert.equal(zoomFromTrack(0, 200), 1);
    assert.equal(zoomFromTrack(200, 200), 3);
    assert.equal(zoomFromTrack(100, 200), 2);
  });

  it('keeps JPEG and PNG without the native module and refuses other formats', () => {
    assert.equal(avatarCropRoute({ manipulatorReady: false, format: 'jpeg' }), 'javascript');
    assert.equal(avatarCropRoute({ manipulatorReady: false, format: 'png' }), 'javascript');
    assert.equal(avatarCropRoute({ manipulatorReady: false, format: 'other' }), 'unavailable');
    assert.equal(avatarCropRoute({ manipulatorReady: true, format: 'other' }), 'native');
  });

  it('restores the previous photo when cropping is cancelled during the save', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
    const storage = new MemoryKeyValueStorage();
    const previous = bytesToDataUrl(new Uint8Array([1, 2, 3]), 'image/png');
    const next = bytesToDataUrl(jpegBytes(4, 4), 'image/jpeg');
    await writeAvatarCache(storage, 'user-1', previous);
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => true,
    });
    let releaseUpload: (value: Response) => void = () => {};
    const pendingUpload = new Promise<Response>((resolve) => {
      releaseUpload = resolve;
    });
    let cancelled = false;
    const saving = commitAvatarChange({
      storage,
      userId: 'user-1',
      email: 'ada@example.com',
      accessToken: 'token',
      dataUrl: next,
      cancelled: () => cancelled,
      fetchImpl: (() => pendingUpload) as typeof fetch,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    cancelled = true;
    releaseUpload({ ok: true, status: 200 } as Response);
    assert.equal(await saving, 'cancelled');
    assert.equal(await readAvatarCache(storage, 'user-1'), previous);
  });

  it('keeps the previous photo when the local save throws', async () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-test';
    const storage = new MemoryKeyValueStorage();
    const previous = bytesToDataUrl(new Uint8Array([1, 2, 3]), 'image/png');
    const next = bytesToDataUrl(jpegBytes(4, 4), 'image/jpeg');
    await writeAvatarCache(storage, 'user-1', previous);
    const original = storage.setItem.bind(storage);
    storage.setItem = async (key, value) => {
      if (key.startsWith('anychess.avatar.cache.')) throw new Error('disk');
      return original(key, value);
    };
    setCloudTransferReadersForTests({
      transport: async () => 'wifi',
      wifiOnly: async () => false,
    });
    const result = await commitAvatarChange({
      storage,
      userId: 'user-1',
      email: 'ada@example.com',
      accessToken: 'token',
      dataUrl: next,
      fetchImpl: (async () => {
        throw new Error('must not upload');
      }) as typeof fetch,
    });
    assert.equal(result, 'failed');
    storage.setItem = original;
    assert.equal(await readAvatarCache(storage, 'user-1'), previous);
  });

  it('does not import the native manipulator unless the module is installed', () => {
    const src = readFileSync(join(mobileRoot, 'lib/profile/avatarImage.ts'), 'utf8');
    const picker = readFileSync(join(mobileRoot, 'lib/profile/pickProfileImage.ts'), 'utf8');
    const splash = readFileSync(join(mobileRoot, 'lib/brand/holdNativeSplash.ts'), 'utf8');
    const layout = readFileSync(join(mobileRoot, 'app/_layout.tsx'), 'utf8');
    const user = readFileSync(join(mobileRoot, 'app/utilisateur.tsx'), 'utf8');
    const settings = readFileSync(join(mobileRoot, 'components/pgn/PgnTranslationSettingsSection.tsx'), 'utf8');
    assert.match(src, /requireOptionalNativeModule\?\.\('ExpoImageManipulator'\)/);
    assert.doesNotMatch(src, /^import .*expo-image-manipulator/m);
    assert.match(picker, /profile image picker failed/);
    assert.match(splash, /keep awake \/ splash hold failed/);
    assert.match(splash, /AppState/);
    assert.match(layout, /holdNativeSplash\(\)/);
    assert.doesNotMatch(layout, /preventAutoHideAsync\(\)/);
    assert.doesNotMatch(user, /profil\.localData/);
    assert.doesNotMatch(settings, /settings\.translationProgressHint/);
    assert.match(settings, /settings\.translationCounts/);
  });
});
