/**
 * Save a finished game into the library and build the unified analyzer route.
 * Prefer `/parties/analyzer` over the legacy `/parties/[gameId]` redirect.
 */
import { GameLibraryStore, gameLibraryStore } from './GameLibraryStore.ts';
import { fingerprintGame, importPgnGames } from './importPgnGames.ts';
import type { ImportedChessGame } from './types.ts';

export type AnalyzerRouteParams = {
  gameId: string;
  tab?: string;
  flipped?: string;
  nodeId?: string;
};

export type AnalyzerHref = {
  pathname: '/parties/analyzer';
  params: AnalyzerRouteParams;
};

export function buildAnalyzerHref(
  gameId: string,
  options?: {
    flipped?: boolean;
    tab?: string;
    nodeId?: string;
  },
): AnalyzerHref {
  const params: AnalyzerRouteParams = { gameId };
  if (options?.tab) params.tab = options.tab;
  if (options?.flipped) params.flipped = '1';
  if (options?.nodeId) params.nodeId = options.nodeId;
  return { pathname: '/parties/analyzer', params };
}

async function resolveImportedGame(
  store: GameLibraryStore,
  pgnText: string,
  fileName: string | undefined,
  displayName: string | undefined,
): Promise<ImportedChessGame | null> {
  const dry = importPgnGames(pgnText, { fileName });
  const candidate = dry.imported[0];
  if (!candidate) return null;

  const imported = await store.importPgnText(pgnText, fileName, {
    displayNames: displayName ? { 0: displayName } : undefined,
  });
  if (imported.imported[0]) return imported.imported[0];

  // Duplicate fingerprint: open the existing library entry.
  const fp =
    candidate.fingerprint ||
    fingerprintGame(
      candidate.headers,
      candidate.initialFen,
      candidate.moves.map((m) => m.san),
    );
  const snap = await store.getSnapshot();
  return snap.games.find((g) => g.fingerprint === fp) ?? null;
}

/**
 * Import (or reuse) a PGN in GameLibraryStore and return the analyzer href.
 */
export async function openPgnInAnalyzer(input: {
  pgnText: string;
  fileName?: string;
  displayName?: string;
  flipped?: boolean;
  tab?: string;
  nodeId?: string;
  store?: GameLibraryStore;
}): Promise<{ gameId: string; href: AnalyzerHref; game: ImportedChessGame } | null> {
  const store = input.store ?? gameLibraryStore;
  const game = await resolveImportedGame(
    store,
    input.pgnText,
    input.fileName,
    input.displayName,
  );
  if (!game) return null;
  return {
    gameId: game.id,
    game,
    href: buildAnalyzerHref(game.id, {
      flipped: input.flipped,
      tab: input.tab ?? 'analysis',
      nodeId: input.nodeId,
    }),
  };
}
