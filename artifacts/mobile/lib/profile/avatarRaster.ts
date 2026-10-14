import jpeg from 'jpeg-js';
import UPNG from 'upng-js';
import { centerCropRect, fittedEdge } from './avatarImage.ts';

export type RgbaImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

/** Center crop, then fit the longest side. Each source pixel is sampled once. */
export function cropAndFitRgba(image: RgbaImage, zoom = 1, maxEdge = 512): RgbaImage {
  const crop = centerCropRect(image.width, image.height, zoom);
  const fitted = fittedEdge(crop.width, crop.height, maxEdge);
  const out = new Uint8Array(fitted.width * fitted.height * 4);
  for (let y = 0; y < fitted.height; y += 1) {
    const srcY = Math.min(
      image.height - 1,
      Math.floor(crop.y + ((y + 0.5) * crop.height) / fitted.height),
    );
    for (let x = 0; x < fitted.width; x += 1) {
      const srcX = Math.min(
        image.width - 1,
        Math.floor(crop.x + ((x + 0.5) * crop.width) / fitted.width),
      );
      const src = (srcY * image.width + srcX) * 4;
      const dst = (y * fitted.width + x) * 4;
      out[dst] = image.data[src] ?? 0;
      out[dst + 1] = image.data[src + 1] ?? 0;
      out[dst + 2] = image.data[src + 2] ?? 0;
      out[dst + 3] = image.data[src + 3] ?? 255;
    }
  }
  return { data: out, width: fitted.width, height: fitted.height };
}

function asBytes(value: Uint8Array | ArrayBuffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

function cloneBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

export function decodeAvatarBytes(bytes: Uint8Array): RgbaImage | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const decoded = jpeg.decode(bytes, { useTArray: true });
    if (!decoded?.width || !decoded.height || !decoded.data) return null;
    return { data: asBytes(decoded.data), width: decoded.width, height: decoded.height };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    const decoded = UPNG.decode(cloneBuffer(bytes));
    const rgba = UPNG.toRGBA8(decoded)[0];
    if (!rgba || !decoded.width || !decoded.height) return null;
    return { data: new Uint8Array(rgba), width: decoded.width, height: decoded.height };
  }
  return null;
}

export function encodeAvatarPng(image: RgbaImage): Uint8Array {
  return new Uint8Array(UPNG.encode([cloneBuffer(image.data)], image.width, image.height, 0));
}

export function prepareAvatarBytes(
  bytes: Uint8Array,
  zoom = 1,
): { bytes: Uint8Array; mime: string } | null {
  const decoded = decodeAvatarBytes(bytes);
  if (!decoded) return null;
  const fitted = cropAndFitRgba(decoded, zoom);
  return { bytes: encodeAvatarPng(fitted), mime: 'image/png' };
}
