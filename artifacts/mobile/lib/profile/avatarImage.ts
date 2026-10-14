/** Longest side kept after crop. PNG output keeps logo transparency. */
export const AVATAR_MAX_EDGE = 512;

export function clampAvatarZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(3, Math.max(1, zoom));
}

/** Center crop that keeps the source aspect ratio. Zoom 1 is the full image. */
export function centerCropRect(
  width: number,
  height: number,
  zoom: number,
): { x: number; y: number; width: number; height: number } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const z = clampAvatarZoom(zoom);
  const cropW = safeW / z;
  const cropH = safeH / z;
  return {
    x: (safeW - cropW) / 2,
    y: (safeH - cropH) / 2,
    width: cropW,
    height: cropH,
  };
}

export type AvatarPreviewLayout = {
  crop: { x: number; y: number; width: number; height: number };
  frameWidth: number;
  frameHeight: number;
  /** Uniform scale of the full image inside the clipped frame. */
  scale: number;
};

/**
 * The clipped frame has the photo's aspect ratio. Scaling it by `zoom`
 * from the center shows exactly `centerCropRect` — the pixels that are saved.
 * Zoom 1 shows the whole photo without stretching.
 */
export function avatarPreviewLayout(input: {
  imageWidth: number;
  imageHeight: number;
  maxWidth: number;
  maxHeight: number;
  zoom: number;
}): AvatarPreviewLayout {
  const imageWidth = Math.max(1, input.imageWidth);
  const imageHeight = Math.max(1, input.imageHeight);
  const maxWidth = Math.max(1, input.maxWidth);
  const maxHeight = Math.max(1, input.maxHeight);
  const zoom = clampAvatarZoom(input.zoom);
  const fit = Math.min(maxWidth / imageWidth, maxHeight / imageHeight);
  return {
    crop: centerCropRect(imageWidth, imageHeight, zoom),
    frameWidth: Math.max(1, Math.round(imageWidth * fit)),
    frameHeight: Math.max(1, Math.round(imageHeight * fit)),
    scale: zoom,
  };
}

/** Map a touch on the crop track to the same zoom the preview uses. */
export function zoomFromTrack(
  locationX: number,
  width: number,
  min = 1,
  max = 3,
): number {
  const span = Math.max(1, width);
  const ratio = Math.min(1, Math.max(0, locationX / span));
  return clampAvatarZoom(min + ratio * (max - min));
}

export type AvatarImageFormat = 'jpeg' | 'png' | 'other';

export function sniffAvatarFormat(bytes: Uint8Array): AvatarImageFormat {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpeg';
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'png';
  }
  return 'other';
}

/**
 * Native crop when the installed client has the module.
 * JPEG and PNG can be cropped in JavaScript. Other formats stay unavailable
 * rather than being saved uncropped.
 */
export function avatarCropRoute(input: {
  manipulatorReady: boolean;
  format: AvatarImageFormat;
}): 'native' | 'javascript' | 'unavailable' {
  if (input.manipulatorReady) return 'native';
  if (input.format === 'jpeg' || input.format === 'png') return 'javascript';
  return 'unavailable';
}

export function fittedEdge(
  width: number,
  height: number,
  maxEdge = AVATAR_MAX_EDGE,
): { width: number; height: number } {
  const safeW = Math.max(1, width);
  const safeH = Math.max(1, height);
  const longest = Math.max(safeW, safeH);
  if (longest <= maxEdge) {
    return { width: Math.round(safeW), height: Math.round(safeH) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(safeW * scale)),
    height: Math.max(1, Math.round(safeH * scale)),
  };
}

export function dataUrlToBytes(
  dataUrl: string,
): { bytes: Uint8Array; mime: string } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) return null;
  const mime = match[1];
  const b64 = match[2].replace(/\s/g, '');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return { bytes, mime };
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

type DrawableImage = {
  naturalWidth: number;
  naturalHeight: number;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

function loadHtmlImage(src: string): Promise<DrawableImage> {
  const ImageCtor = (globalThis as { Image?: new () => DrawableImage }).Image;
  if (!ImageCtor) return Promise.reject(new Error('image'));
  return new Promise((resolve, reject) => {
    const img = new ImageCtor();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image'));
    img.src = src;
  });
}

/**
 * Crop from the center (zoom 1 keeps the whole frame) and shrink the longest
 * side to 512px. Output is PNG so a logo's transparency survives.
 * Web uses canvas. Native uses expo-image-manipulator (dev-client rebuild).
 */
export type AvatarPrepareError = 'unsupported' | 'failed' | 'unavailable';

export async function prepareAvatarImage(input: {
  uri: string;
  zoom?: number;
}): Promise<{ dataUrl: string } | { error: AvatarPrepareError }> {
  const zoom = clampAvatarZoom(input.zoom ?? 1);
  if (typeof document !== 'undefined' && typeof Image !== 'undefined') {
    try {
      const img = await loadHtmlImage(input.uri);
      const crop = centerCropRect(img.naturalWidth, img.naturalHeight, zoom);
      const fitted = fittedEdge(crop.width, crop.height);
      const canvas = document.createElement('canvas') as HTMLCanvasElement;
      canvas.width = fitted.width;
      canvas.height = fitted.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { error: 'unsupported' };
      ctx.clearRect(0, 0, fitted.width, fitted.height);
      ctx.drawImage(
        img as unknown as CanvasImageSource,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        fitted.width,
        fitted.height,
      );
      return { dataUrl: canvas.toDataURL('image/png') };
    } catch {
      return { error: 'unsupported' };
    }
  }
  return prepareAvatarImageNative(input.uri, zoom);
}

function nativeManipulatorReady(): boolean {
  try {
    const core = require('expo-modules-core') as {
      requireOptionalNativeModule?: (name: string) => object | null;
    };
    return Boolean(core.requireOptionalNativeModule?.('ExpoImageManipulator'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnyChess] ExpoImageManipulator probe failed: ${message}`);
    return false;
  }
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readUriBytes(uri: string): Promise<Uint8Array | null> {
  if (uri.startsWith('data:')) return dataUrlToBytes(uri)?.bytes ?? null;
  try {
    const response = await withTimeout(fetch(uri), 8000);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnyChess] avatar read failed: ${message}`);
    return null;
  }
}

async function prepareAvatarWithInstalledManipulator(
  uri: string,
  zoom: number,
): Promise<{ dataUrl: string }> {
  const { Image } = await import('react-native');
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
  const crop = centerCropRect(size.width, size.height, zoom);
  const fitted = fittedEdge(crop.width, crop.height);
  const manipulator = await import('expo-image-manipulator');
  const result = await manipulator.manipulateAsync(
    uri,
    [
      {
        crop: {
          originX: Math.round(crop.x),
          originY: Math.round(crop.y),
          width: Math.max(1, Math.round(crop.width)),
          height: Math.max(1, Math.round(crop.height)),
        },
      },
      { resize: fitted },
    ],
    { compress: 1, format: manipulator.SaveFormat.PNG },
  );
  const response = await fetch(result.uri);
  const buffer = await response.arrayBuffer();
  return { dataUrl: bytesToDataUrl(new Uint8Array(buffer), 'image/png') };
}

async function prepareAvatarWithJavascript(
  bytes: Uint8Array,
  zoom: number,
): Promise<{ dataUrl: string } | null> {
  const { prepareAvatarBytes } = await import('./avatarRaster.ts');
  const prepared = prepareAvatarBytes(bytes, zoom);
  if (!prepared) return null;
  return { dataUrl: bytesToDataUrl(prepared.bytes, prepared.mime) };
}

async function prepareAvatarImageNative(
  uri: string,
  zoom: number,
): Promise<{ dataUrl: string } | { error: AvatarPrepareError }> {
  const manipulatorReady = nativeManipulatorReady();
  try {
    if (manipulatorReady) {
      try {
        return await prepareAvatarWithInstalledManipulator(uri, zoom);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[AnyChess] ExpoImageManipulator crop failed: ${message}`);
      }
    } else {
      console.warn(
        '[AnyChess] ExpoImageManipulator is not in this client. JPEG and PNG are cropped in JavaScript.',
      );
    }
    const bytes = await readUriBytes(uri);
    if (!bytes) return { error: 'failed' };
    const route = avatarCropRoute({
      manipulatorReady: false,
      format: sniffAvatarFormat(bytes),
    });
    if (route === 'unavailable') {
      console.warn(
        '[AnyChess] avatar format unsupported without ExpoImageManipulator. The previous photo is kept.',
      );
      return { error: 'unavailable' };
    }
    const prepared = await prepareAvatarWithJavascript(bytes, zoom);
    if (!prepared) return { error: 'failed' };
    return prepared;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[AnyChess] avatar crop failed: ${message}`);
    return { error: 'failed' };
  }
}
