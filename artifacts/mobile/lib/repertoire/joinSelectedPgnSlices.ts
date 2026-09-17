/**
 * Build a repertoire PGN text from light-index selections.
 * Reuses Game Library offsets — no full-file parse before selection.
 */
import {
  extractPgnSlice,
  type PgnGameIndexEntry,
} from '../gameLibrary/indexPgnGamesLight.ts';

export function joinSelectedPgnSlices(
  sourceText: string,
  entries: readonly PgnGameIndexEntry[],
  selectedIndices: readonly number[],
): string {
  const byIndex = new Map(entries.map((e) => [e.index, e]));
  const parts: string[] = [];
  for (const index of selectedIndices) {
    const entry = byIndex.get(index);
    if (!entry) continue;
    const slice = extractPgnSlice(sourceText, entry).trim();
    if (slice) parts.push(slice);
  }
  return parts.join('\n\n');
}

/** Keep selected PGN games separate, preserving their authored titles. */
export function selectedPgnImports(
  sourceText: string,
  entries: readonly PgnGameIndexEntry[],
  selectedIndices: readonly number[],
  filename: string,
): { filename: string; displayName?: string; pgnText: string }[] {
  const selected = new Set(selectedIndices);
  return entries
    .filter((entry) => selected.has(entry.index))
    .map((entry) => {
      const meaningful = (value?: string) =>
        value?.trim() && value.trim() !== '?' ? value.trim() : undefined;
      const players = [meaningful(entry.white), meaningful(entry.black)]
        .filter(Boolean)
        .join(' – ');
      const title = players || meaningful(entry.event) || `Partie ${entry.index + 1}`;
      return {
        filename,
        displayName: entries.length > 1 ? title : undefined,
        pgnText: extractPgnSlice(sourceText, entry),
      };
    });
}

