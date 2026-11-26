export type ImportablePgn = {
  pgnText: string;
  filename?: string;
  displayName?: string;
};
/** Preserve successful local writes and report every failed game independently. */
export async function importPgnBatch(
  games: ImportablePgn[],
  write: (game: ImportablePgn) => Promise<unknown>,
) {
  let imported = 0;
  const failedFiles: string[] = [];
  for (const game of games) {
    try {
      if (!game.pgnText.trim()) throw Error('empty');
      await write(game);
      imported++;
    } catch {
      failedFiles.push(game.filename || 'opening.pgn');
    }
  }
  return { imported, failed: failedFiles.length, failedFiles };
}
