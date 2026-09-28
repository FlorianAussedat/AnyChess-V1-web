/**
 * Shared PGN load prep — light index + slice extract, no full-tree parse.
 */
import {
  extractPgnSlice,
  indexPgnGamesLight,
  type PgnGameIndexEntry,
} from '../gameLibrary/indexPgnGamesLight.ts';

export type PreparedPgnSource = {
  filename?: string;
  sourceText: string;
  entries: PgnGameIndexEntry[];
};

export function preparePgnSource(
  text: string,
  filename?: string,
): PreparedPgnSource {
  const sourceText = typeof text === 'string' ? text : '';
  return {
    filename,
    sourceText,
    entries: indexPgnGamesLight(sourceText).entries,
  };
}

export function selectedPgnSlices(
  source: PreparedPgnSource,
  selectedIndices: readonly number[],
): { pgnText: string; displayName?: string }[] {
  const selected = new Set(selectedIndices);
  return source.entries
    .filter((entry) => selected.has(entry.index))
    .map((entry) => {
      const players = [entry.white, entry.black]
        .map((v) => v?.trim())
        .filter((v) => v && v !== '?');
      const displayName =
        source.entries.length > 1
          ? players.length > 0
            ? players.join(' – ')
            : entry.event?.trim() || `Partie ${entry.index + 1}`
          : undefined;
      return {
        pgnText: extractPgnSlice(source.sourceText, entry),
        displayName,
      };
    })
    .filter((item) => item.pgnText.trim().length > 0);
}
