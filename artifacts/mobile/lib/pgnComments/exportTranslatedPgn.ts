/**
 * Build exported PGN copies without mutating the stored original.
 */
export type PgnExportMode = 'original' | 'french' | 'bilingual';

function replaceComment(original: string, replacement: string, mode: PgnExportMode): string {
  if (mode === 'original') return original;
  if (mode === 'french') return replacement;
  return `${replacement} [orig: ${original}]`;
}

export function applyFrenchToPgnText(
  pgnText: string,
  replacements: { original: string; french: string }[],
  mode: PgnExportMode,
): string {
  if (mode === 'original') return pgnText;
  let next = pgnText;
  for (const item of replacements) {
    if (!item.original || !item.french) continue;
    const wrapped = `{${item.original}}`;
    if (!next.includes(wrapped)) continue;
    next = next.split(wrapped).join(`{${replaceComment(item.original, item.french, mode)}}`);
  }
  return next;
}
