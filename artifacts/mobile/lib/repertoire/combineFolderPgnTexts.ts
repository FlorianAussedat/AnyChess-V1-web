/**
 * Concatenate enabled opening-folder PGN files the same way
 * `RepertoireService.buildFolderRepertoire` does, so analyzer export can walk
 * the original annotated trees (not the FEN-keyed DAG).
 */
export function combineFolderPgnTexts(
  files: readonly { filename: string; pgnText: string }[],
): string {
  return files
    .map((f) => {
      const hasHeaders = /^\s*\[/.test(f.pgnText);
      const sourceTag = `[Source "${f.filename.replace(/"/g, '')}"]\n`;
      return hasHeaders ? `${sourceTag}${f.pgnText}` : `${sourceTag}\n${f.pgnText}`;
    })
    .join('\n\n');
}
