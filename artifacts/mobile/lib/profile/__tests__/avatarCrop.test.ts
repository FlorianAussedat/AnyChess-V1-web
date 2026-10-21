import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import jpeg from 'jpeg-js';
import {
  avatarCropRect,
  avatarCropPreview,
  clampAvatarPosition,
  panAvatarPosition,
} from '../avatarCrop.ts';
import {
  cropAndFitRgba,
  decodeAvatarBytes,
  encodeAvatarPng,
  fitAvatarRgba,
  orientAvatarRgba,
  prepareAvatarBytes,
} from '../avatarRaster.ts';
import { avatarExifOrientation } from '../avatarExif.ts';
import {
  bytesToDataUrl,
  dataUrlToBytes,
  prepareAvatarImage,
  prepareAvatarSource,
} from '../avatarImage.ts';

function pixels(width: number, height: number) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      data.set(
        [(x * 7) % 256, (y * 9) % 256, (x + y) % 256, (x + y) % 3 ? 255 : 0],
        (y * width + x) * 4,
      );
    }
  return { data, width, height };
}

describe('shared crop geometry and pixels', () => {
  for (const [width, height] of [
    [81, 157],
    [157, 81],
    [93, 93],
  ]) {
    for (const zoom of [1, 1.37, 2, 3]) {
      it(`${width}x${height}, zoom ${zoom}: visible corners equal encoded pixels after a two-axis drag`, () => {
        const source = pixels(width, height);
        const position = panAvatarPosition({
          width,
          height,
          zoom,
          frame: 220,
          position: { x: 0.5, y: 0.5 },
          dx: -71,
          dy: 57,
        });
        const preview = avatarCropPreview(width, height, 220, zoom, position);
        const rect = preview.crop;
        assert.equal(rect.width, rect.height);
        assert.ok(rect.x >= 0 && rect.y >= 0);
        assert.ok(
          rect.x + rect.width <= width && rect.y + rect.height <= height,
        );
        const scale = preview.width / width;
        assert.ok(Math.abs(-preview.left / scale - rect.x) < 1e-10);
        assert.ok(Math.abs(-preview.top / scale - rect.y) < 1e-10);
        assert.ok(preview.left <= 0 && preview.top <= 0);
        assert.ok(preview.left + preview.width >= 220 - 1e-9);
        assert.ok(preview.top + preview.height >= 220 - 1e-9);
        const prepared = prepareAvatarBytes(
          encodeAvatarPng(source),
          zoom,
          position,
        )!;
        const decoded = decodeAvatarBytes(prepared.bytes)!;
        assert.deepEqual(decoded, cropAndFitRgba(source, zoom, 512, position));
        // Full-resolution crop: verify source corners independently of the geometry helper.
        for (const [x, y] of [
          [0, 0],
          [rect.width - 1, 0],
          [0, rect.height - 1],
          [rect.width - 1, rect.height - 1],
        ]) {
          const start = ((rect.y + y) * width + rect.x + x) * 4;
          const output = (y * decoded.width + x) * 4;
          assert.deepEqual(
            [...decoded.data.slice(output, output + 4)],
            [...source.data.slice(start, start + 4)],
          );
        }
      });
    }
  }

  it('pans horizontally and vertically, clamps all edges, and preserves the center while zooming', () => {
    const input = {
      width: 800,
      height: 600,
      zoom: 2,
      frame: 200,
      position: { x: 0.5, y: 0.5 },
    };
    const moved = panAvatarPosition({ ...input, dx: -100, dy: 50 });
    assert.ok(moved.x > 0.5 && moved.y < 0.5);
    const tighter = clampAvatarPosition(800, 600, 3, moved);
    assert.ok(Math.abs(tighter.x - moved.x) < 1 / 800);
    assert.ok(Math.abs(tighter.y - moved.y) < 1 / 600);
    for (const dx of [-1e6, 1e6])
      for (const dy of [-1e6, 1e6]) {
        const rect = avatarCropRect(
          800,
          600,
          2,
          panAvatarPosition({ ...input, dx, dy }),
        );
        assert.equal(rect.x, dx > 0 ? 0 : 500);
        assert.equal(rect.y, dy > 0 ? 0 : 300);
      }
  });

  it('caps final output to 512 pixels and keeps PNG transparency', () => {
    const source = pixels(840, 660);
    const output = cropAndFitRgba(source, 1, 512);
    assert.equal(output.width, 512);
    assert.equal(output.height, 512);
    assert.ok(
      output.data.some((value, index) => index % 4 === 3 && value === 0),
    );
    const decoded = decodeAvatarBytes(encodeAvatarPng(output))!;
    assert.deepEqual(decoded.data, output.data);
    assert.deepEqual(fitAvatarRgba(pixels(100, 50), 100), pixels(100, 50));
  });
});

function exifJpeg(orientation: number, little = true) {
  const source = pixels(6, 4);
  const raw = jpeg.encode(source, 95).data;
  const segment = new Uint8Array(36);
  segment.set([0xff, 0xe1, 0, 34, 69, 120, 105, 102, 0, 0]);
  const tiff = new DataView(segment.buffer, 10);
  tiff.setUint16(0, little ? 0x4949 : 0x4d4d);
  tiff.setUint16(2, 42, little);
  tiff.setUint32(4, 8, little);
  tiff.setUint16(8, 1, little);
  tiff.setUint16(10, 0x0112, little);
  tiff.setUint16(12, 3, little);
  tiff.setUint32(14, 1, little);
  tiff.setUint16(18, orientation, little);
  const bytes = new Uint8Array(raw.length + segment.length);
  bytes.set(raw.subarray(0, 2));
  bytes.set(segment, 2);
  bytes.set(raw.subarray(2), 2 + segment.length);
  return { bytes, raw };
}

describe('oriented imports without a native rebuild', () => {
  it('maps all eight orientations to known pixel coordinates, including mirrored photos', () => {
    const data = new Uint8Array(
      [1, 2, 3, 4, 5, 6].flatMap((value) => [value, 0, 0, 255]),
    );
    const expected = [
      [1, 2, 3, 4, 5, 6],
      [2, 1, 4, 3, 6, 5],
      [6, 5, 4, 3, 2, 1],
      [5, 6, 3, 4, 1, 2],
      [1, 3, 5, 2, 4, 6],
      [5, 3, 1, 6, 4, 2],
      [6, 4, 2, 5, 3, 1],
      [2, 4, 6, 1, 3, 5],
    ];
    for (let index = 0; index < 8; index++) {
      const oriented = orientAvatarRgba(
        { data, width: 2, height: 3 },
        index + 1,
      );
      assert.deepEqual(
        [...oriented.data].filter((_value, pixel) => pixel % 4 === 0),
        expected[index],
      );
    }
  });
  for (let orientation = 1; orientation <= 8; orientation++) {
    it(`handles EXIF orientation ${orientation} before preview and crop`, async () => {
      const { bytes, raw } = exifJpeg(orientation, orientation % 2 === 1);
      assert.equal(avatarExifOrientation(bytes), orientation);
      const decoded = decodeAvatarBytes(bytes)!;
      assert.deepEqual(
        decoded,
        orientAvatarRgba(decodeAvatarBytes(raw)!, orientation),
      );
      const prepared = await prepareAvatarSource(
        bytesToDataUrl(bytes, 'image/jpeg'),
      );
      assert.ok(!('error' in prepared));
      if ('error' in prepared) return;
      assert.equal(prepared.width, orientation >= 5 ? 4 : 6);
      assert.equal(prepared.height, orientation >= 5 ? 6 : 4);
      const normalized = dataUrlToBytes(prepared.uri)!.bytes;
      assert.equal(avatarExifOrientation(normalized), 1);
      assert.deepEqual(decodeAvatarBytes(normalized), decoded);
      const output = await prepareAvatarImage({
        uri: prepared.uri,
        zoom: 2,
        position: { x: 0.9, y: 0.1 },
      });
      assert.ok(!('error' in output));
      if (!('error' in output))
        assert.deepEqual(
          decodeAvatarBytes(dataUrlToBytes(output.dataUrl)!.bytes),
          cropAndFitRgba(decoded, 2, 512, { x: 0.9, y: 0.1 }),
        );
    });
  }
  it('rejects unreadable formats and ignores malformed EXIF without throwing', async () => {
    assert.equal(
      avatarExifOrientation(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 255, 255])),
      1,
    );
    assert.equal(decodeAvatarBytes(new Uint8Array([1, 2, 3])), null);
    assert.deepEqual(await prepareAvatarSource('data:image/webp;base64,AQID'), {
      error: 'unavailable',
    });
  });
});

describe('Web canvas export uses the same source rectangle', () => {
  it('sends the preview rectangle to drawImage, including pan and non-integer zoom', async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const oldImage = globals.Image,
      oldDocument = globals.document;
    let draw: unknown[] = [];
    class FakeImage {
      naturalWidth = 641;
      naturalHeight = 359;
      onload?: () => void;
      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }
    globals.Image = FakeImage;
    globals.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          clearRect() {},
          drawImage(...args: unknown[]) {
            draw = args;
          },
        }),
        toDataURL: () => 'data:image/png;base64,output',
      }),
    };
    try {
      const position = { x: 0.85, y: 0.2 },
        zoom = 1.37;
      const preview = avatarCropPreview(641, 359, 220, zoom, position);
      await prepareAvatarImage({ uri: 'photo', zoom, position });
      assert.deepEqual(draw.slice(1, 5), [
        preview.crop.x,
        preview.crop.y,
        preview.crop.width,
        preview.crop.height,
      ]);
    } finally {
      if (oldImage === undefined) delete globals.Image;
      else globals.Image = oldImage;
      if (oldDocument === undefined) delete globals.document;
      else globals.document = oldDocument;
    }
  });
});
