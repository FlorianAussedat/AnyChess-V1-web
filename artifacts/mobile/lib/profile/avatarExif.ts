/** Minimal, bounded EXIF orientation reader for JPEG APP1 and PNG eXIf. */
function tiffOrientation(
  bytes: Uint8Array,
  offset: number,
  length: number,
): number {
  if (length < 8 || offset + length > bytes.length) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, length);
  const little = view.getUint16(0) === 0x4949;
  if (!little && view.getUint16(0) !== 0x4d4d) return 1;
  if (view.getUint16(2, little) !== 42) return 1;
  const directory = view.getUint32(4, little);
  if (directory + 2 > length) return 1;
  const count = view.getUint16(directory, little);
  for (let i = 0; i < count; i++) {
    const entry = directory + 2 + i * 12;
    if (entry + 12 > length) break;
    if (
      view.getUint16(entry, little) === 0x0112 &&
      view.getUint16(entry + 2, little) === 3 &&
      view.getUint32(entry + 4, little) === 1
    ) {
      const value = view.getUint16(entry + 8, little);
      return value >= 1 && value <= 8 ? value : 1;
    }
  }
  return 1;
}

export function avatarExifOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let start = 2; start + 4 <= bytes.length;) {
      if (bytes[start] !== 0xff) break;
      const marker = bytes[start + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const size = view.getUint16(start + 2);
      if (size < 2 || start + size + 2 > bytes.length) break;
      if (
        marker === 0xe1 &&
        size >= 8 &&
        String.fromCharCode(...bytes.subarray(start + 4, start + 10)) ===
          'Exif\0\0'
      ) {
        return tiffOrientation(bytes, start + 10, size - 8);
      }
      start += size + 2;
    }
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    for (let start = 8; start + 12 <= bytes.length;) {
      const size = view.getUint32(start);
      if (start + size + 12 > bytes.length) break;
      if (
        String.fromCharCode(...bytes.subarray(start + 4, start + 8)) === 'eXIf'
      ) {
        return tiffOrientation(bytes, start + 8, size);
      }
      start += size + 12;
    }
  }
  return 1;
}
