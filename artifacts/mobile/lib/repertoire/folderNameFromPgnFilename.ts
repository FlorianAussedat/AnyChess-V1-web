/** Derive a repertoire folder name from a PGN filename. */
export function folderNameFromPgnFilename(filename: string): string {
  const trimmed = filename.trim();
  const withoutExt = trimmed.replace(/\.pgn$/i, '').trim();
  return withoutExt || trimmed || 'PGN';
}
