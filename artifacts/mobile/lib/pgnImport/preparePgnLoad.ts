/**
 * Shared PGN load prep — light index + slice extract, no full-tree parse.
 */
import {
  extractPgnSlice,
  indexPgnGamesLight,
  type PgnGameIndexEntry,
} from '../gameLibrary/indexPgnGamesLight.ts';
import type { PickedPgnFile } from '../files/readPgnFile.ts';

export type PreparedPgnSource = {
  filename?: string;
  sourceText: string;
  entries: PgnGameIndexEntry[];
  filenamesByIndex?: Record<number, string>;
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
): { pgnText: string; displayName?: string; filename?: string }[] {
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
        ...(source.filenamesByIndex
          ? { filename: source.filenamesByIndex[entry.index] }
          : {}),
        displayName,
      };
    })
    .filter((item) => item.pgnText.trim().length > 0);
}

/** Index every file independently: headerless files cannot accidentally become one game. */
export function preparePgnFiles(files: PickedPgnFile[]): {
  source: PreparedPgnSource;
  issues: { filename: string; reason: string }[];
} {
  const source: PreparedPgnSource = {
    sourceText: '',
    entries: [],
    filenamesByIndex: {},
    filename: files.map((f) => f.filename).join(' · '),
  };
  const issues: { filename: string; reason: string }[] = [];
  for (const file of files) {
    if (file.error) {
      issues.push({ filename: file.filename, reason: file.error });
      continue;
    }
    const prepared = preparePgnSource(file.text, file.filename);
    if (!prepared.entries.length) {
      issues.push({
        filename: file.filename,
        reason: file.text.trim() ? 'invalid' : 'empty',
      });
      continue;
    }
    const offset = source.sourceText.length;
    source.sourceText += file.text + '\n\n';
    for (const entry of prepared.entries) {
      const index = source.entries.length;
      source.entries.push({
        ...entry,
        index,
        startOffset: offset + entry.startOffset,
        endOffset: offset + entry.endOffset,
      });
      source.filenamesByIndex![index] = file.filename;
    }
  }
  return { source, issues };
}
