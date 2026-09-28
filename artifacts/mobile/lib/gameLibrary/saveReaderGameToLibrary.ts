/**
 * Persist a working analyzer game into the game library.
 * Default destination is the system “À classer” folder.
 * Empty / FEN-only games are allowed — importPgnGames rejects zero-move PGNs.
 */
import { serializeReaderGamePgn } from '../analysis/exportEnrichedPgn.ts';
import type { ReaderGame, ReaderNode } from '../gameReader/types.ts';
import { fingerprintGame } from './importPgnGames.ts';
import { GameLibraryStore, gameLibraryStore } from './GameLibraryStore.ts';
import type { ImportedChessGame, ImportedGameMove } from './types.ts';

function mainLineMoves(game: ReaderGame): ImportedGameMove[] {
  const moves: ImportedGameMove[] = [];
  let id: string | null = game.rootIds[0] ?? null;
  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    moves.push({
      ply: moves.length + 1,
      san: node.san,
      fenAfter: node.fenAfter,
      comment: node.comment,
      nags: node.nags,
    });
    id = node.childIds[0] ?? null;
  }
  return moves;
}

function newGameId(): string {
  return `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function saveReaderGameToLibrary(input: {
  game: ReaderGame;
  displayName?: string;
  folderId?: string | null;
  store?: GameLibraryStore;
}): Promise<ImportedChessGame | null> {
  const store = input.store ?? gameLibraryStore;
  const folderId = input.folderId ?? (await store.getUnfiledFolderId());
  const pgnText = serializeReaderGamePgn(input.game, {
    includeEvals: false,
    includeBest: false,
  });
  const moves = mainLineMoves(input.game);
  const headers = {
    white: input.game.headers.white,
    black: input.game.headers.black,
    result: input.game.headers.result ?? input.game.result,
    event: input.game.headers.event,
    site: input.game.headers.site,
    date: input.game.headers.date,
    eco: input.game.headers.eco,
    opening: input.game.headers.opening,
  };
  const fingerprint = fingerprintGame(
    headers,
    input.game.initialFen,
    moves.map((m) => m.san),
  );
  const existing = (await store.getSnapshot()).games.find(
    (g) => g.fingerprint === fingerprint,
  );
  if (existing) return existing;

  const imported: ImportedChessGame = {
    id: input.game.id.startsWith('game_') ? input.game.id : newGameId(),
    fingerprint,
    headers,
    initialFen: input.game.initialFen,
    moves,
    hasVariations: input.game.hasVariations,
    folderId,
    displayName: input.displayName,
    source: {
      importedAt: Date.now(),
      rawPgn: pgnText,
    },
  };
  await store.addGames([imported]);
  return (await store.getGame(imported.id)) ?? imported;
}
