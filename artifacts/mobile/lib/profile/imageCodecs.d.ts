declare module 'jpeg-js' {
  export function encode(
    image: { data: Uint8Array; width: number; height: number },
    quality: number,
  ): { data: Uint8Array };
  export function decode(
    data: Uint8Array,
    opts?: { useTArray?: boolean; maxResolutionInMP?: number; maxMemoryUsageInMB?: number },
  ): { data: Uint8Array; width: number; height: number };
}

declare module 'upng-js' {
  const UPNG: {
    encode(bufs: ArrayBuffer[], width: number, height: number, colorCount: number, delays?: number[], forbidPalette?: boolean): ArrayBuffer;
    decode(buffer: ArrayBuffer): { width: number; height: number };
    toRGBA8(img: { width: number; height: number }): ArrayBuffer[];
  };
  export default UPNG;
}
