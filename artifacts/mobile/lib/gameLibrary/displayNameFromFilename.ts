/**
 * Default game title from an imported PGN filename (no extension).
 * Headers (Event, etc.) stay in metadata and do not override this.
 */
export function displayNameFromFilename(fileName: string | undefined | null): string {
  const raw = (fileName ?? '').trim();
  if (!raw) return '';
  const base = raw.split(/[/\\]/).pop() ?? raw;
  const withoutExt = base.replace(/\.pgn$/i, '').trim();
  return withoutExt;
}

export const MAX_PGN_IMPORT_BATCH = 10;
