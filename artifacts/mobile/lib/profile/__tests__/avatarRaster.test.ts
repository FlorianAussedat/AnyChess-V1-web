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
import { bytesToDataUrl } from '../avatarImage.ts';
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
    assert.equal(fitted.height, 1);
  });

  it('keeps the previous avatar when the upload fails and defers on cellular', async () => {
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
    assert.equal(failed, 'failed');
    assert.equal(calls, 1);
    assert.equal(await readAvatarCache(storage, 'user-1'), previous);
    assert.equal(await readPendingAvatar(storage), null);

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
