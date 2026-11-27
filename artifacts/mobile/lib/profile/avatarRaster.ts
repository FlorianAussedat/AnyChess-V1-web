import { avatarCropRect, type AvatarPosition } from './avatarCrop.ts';
import { avatarExifOrientation } from './avatarExif.ts';
import jpeg from 'jpeg-js';
import UPNG from 'upng-js';
import { fittedEdge } from './avatarImage.ts';

export type RgbaImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

/** Center crop, then fit the longest side. Each source pixel is sampled once. */
export function cropAndFitRgba(
  image: RgbaImage,
  zoom = 1,
  maxEdge = 512,
  position?: AvatarPosition,
): RgbaImage {
  const crop = avatarCropRect(image.width, image.height, zoom, position);
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

function decodeRawAvatarBytes(bytes: Uint8Array): RgbaImage | null {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const decoded = jpeg.decode(bytes, {
      useTArray: true,
      maxResolutionInMP: 32,
      maxMemoryUsageInMB: 192,
    });
    if (!decoded?.width || !decoded.height || !decoded.data) return null;
    return {
      data: asBytes(decoded.data),
      width: decoded.width,
      height: decoded.height,
    };
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
    return {
      data: new Uint8Array(rgba),
      width: decoded.width,
      height: decoded.height,
    };
  }
  return null;
}

export function encodeAvatarPng(image: RgbaImage): Uint8Array {
  return new Uint8Array(
    UPNG.encode(
      [cloneBuffer(image.data)],
      image.width,
      image.height,
      0,
      undefined,
      true,
    ),
  );
}

export function prepareAvatarBytes(
  bytes: Uint8Array,
  zoom = 1,
  position?: AvatarPosition,
): { bytes: Uint8Array; mime: string } | null {
  const decoded = decodeAvatarBytes(bytes);
  if (!decoded) return null;
  const fitted = cropAndFitRgba(decoded, zoom, 512, position);
  return { bytes: encodeAvatarPng(fitted), mime: 'image/png' };
}

export function orientAvatarRgba(
  image: RgbaImage,
  orientation: number,
): RgbaImage {
  if (orientation <= 1 || orientation > 8) return image;
  const swap = orientation >= 5;
  const width = swap ? image.height : image.width;
  const height = swap ? image.width : image.height;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      let dx = x,
        dy = y;
      switch (orientation) {
        case 2:
          dx = image.width - 1 - x;
          break;
        case 3:
          dx = image.width - 1 - x;
          dy = image.height - 1 - y;
          break;
        case 4:
          dy = image.height - 1 - y;
          break;
        case 5:
          dx = y;
          dy = x;
          break;
        case 6:
          dx = image.height - 1 - y;
          dy = x;
          break;
        case 7:
          dx = image.height - 1 - y;
          dy = image.width - 1 - x;
          break;
        case 8:
          dx = y;
          dy = image.width - 1 - x;
          break;
      }
      const source = (y * image.width + x) * 4;
      data.set(image.data.subarray(source, source + 4), (dy * width + dx) * 4);
    }
  return { data, width, height };
}

export function decodeAvatarBytes(bytes: Uint8Array): RgbaImage | null {
  try {
    const raw = decodeRawAvatarBytes(bytes);
    return raw ? orientAvatarRgba(raw, avatarExifOrientation(bytes)) : null;
  } catch {
    return null;
  }
}

/** Downsize the oriented source without cropping or losing its alpha channel. */
export function fitAvatarRgba(image: RgbaImage, maxEdge: number): RgbaImage {
  const size = fittedEdge(image.width, image.height, maxEdge);
  if (size.width === image.width && size.height === image.height) return image;
  const data = new Uint8Array(size.width * size.height * 4);
  for (let y = 0; y < size.height; y++)
    for (let x = 0; x < size.width; x++) {
      const sx = Math.min(
        image.width - 1,
        Math.floor(((x + 0.5) * image.width) / size.width),
      );
      const sy = Math.min(
        image.height - 1,
        Math.floor(((y + 0.5) * image.height) / size.height),
      );
      const start = (sy * image.width + sx) * 4;
      data.set(image.data.subarray(start, start + 4), (y * size.width + x) * 4);
    }
  return { data, ...size };
}
