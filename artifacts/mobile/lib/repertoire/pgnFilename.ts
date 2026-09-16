/**
 * PGN filename normalization and unique-name policy for new imports.
 */

/** Normalize a display/import name to a `.pgn` filename. */
export function normaliseFilename(name: string): string {
  const trimmed = name.trim() || 'import.pgn';
  return trimmed.toLowerCase().endsWith('.pgn') ? trimmed : `${trimmed}.pgn`;
}

/**
 * Pick a unique filename within a folder.
 * Sicilian.pgn → Sicilian (2).pgn → Sicilian (3).pgn …
 */
export function uniquePgnFilename(
  desired: string,
  existingNames: readonly string[],
): string {
  const base = normaliseFilename(desired);
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;

  const stem = base.replace(/\.pgn$/i, '');
  let n = 2;
  while (taken.has(`${stem} (${n}).pgn`.toLowerCase())) n += 1;
  return `${stem} (${n}).pgn`;
}
