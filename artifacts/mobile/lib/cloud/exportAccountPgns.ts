import { presentAppDialog } from '../ui/appDialogStore.ts';
import { tMsg } from '../i18n/tMsg.ts';
import type { ExportResult } from '../files/chessFileTransfer.ts';
import { requestPgnExport } from '../files/presentChessExport.ts';
import { repertoireService } from '../repertoire/index.ts';
import { gameLibraryStore } from '../gameLibrary/GameLibraryStore.ts';
import { anyChessPgnFilename } from '../pgn/PgnExporter.ts';

export async function accountHasExportablePgns(): Promise<boolean> {
  await repertoireService.ensureLoaded();
  if (repertoireService.getAllFiles().some((file) => file.pgnText.trim()))
    return true;
  const games = await gameLibraryStore.listGames();
  return games.some((game) => Boolean(game.source.rawPgn?.trim()));
}

/** One export built from repertoire files and saved games, with an explicit outcome. */
let gathering = false;
export async function exportAccountPgns(): Promise<ExportResult> {
  if (gathering) return { kind: 'busy' };
  gathering = true;
  try {
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
    if (!parts.length) return { kind: 'unavailable' };
    return await requestPgnExport(
      anyChessPgnFilename(),
      `${parts.join('\n\n')}\n`,
    );
  } catch {
    presentAppDialog({
      title: tMsg('files.export'),
      message: tMsg('files.failed'),
      variant: 'info',
      actions: [
        {
          label: tMsg('files.retry'),
          onPress: () => {
            void exportAccountPgns();
          },
        },
        { label: tMsg('common.close'), onPress: () => {} },
      ],
    });
    return { kind: 'failed' };
  } finally {
    gathering = false;
  }
}
