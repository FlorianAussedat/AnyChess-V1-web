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
export async function prepareAvatarImage(input: {
  uri: string;
  zoom?: number;
}): Promise<{ dataUrl: string } | { error: 'unsupported' }> {
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

async function prepareAvatarImageNative(
  uri: string,
  zoom: number,
): Promise<{ dataUrl: string } | { error: 'unsupported' }> {
  try {
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
  } catch {
    return { error: 'unsupported' };
  }
}
