import { repertoireService } from '../repertoire/index.ts';
import { gameLibraryStore } from '../gameLibrary/GameLibraryStore.ts';
import { anyChessPgnFilename, downloadPgnFile } from '../pgn/PgnExporter.ts';

export async function accountHasExportablePgns(): Promise<boolean> {
  await repertoireService.ensureLoaded();
  if (repertoireService.getAllFiles().some((file) => file.pgnText.trim())) return true;
  const games = await gameLibraryStore.listGames();
  return games.some((game) => Boolean(game.source.rawPgn?.trim()));
}

/** One download built from repertoire files and saved games. Returns false when empty. */
export async function exportAccountPgns(): Promise<boolean> {
  await repertoireService.ensureLoaded();
  const parts: string[] = [];
  for (const file of repertoireService.getAllFiles()) {
    const text = file.pgnText.trim();
    if (text) parts.push(text);
  }
  const games = await gameLibraryStore.listGames();
  for (const game of games) {
    const text = game.source.rawPgn?.trim();
    if (text) parts.push(text);
  }
  if (!parts.length) return false;
  downloadPgnFile(anyChessPgnFilename(), `${parts.join('\n\n')}\n`);
  return true;
}
