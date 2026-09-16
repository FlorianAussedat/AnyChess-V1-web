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
