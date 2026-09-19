/**
 * Handoff from exercise modes into the unified Lecteur / Analyseur workspace.
 *
 * Reuses Game Library import (same path as Partie classique) plus
 * `anychess.gameSession.v1` so the analyzer restores:
 * - startFen + moves (Analyser la partie)
 * - current fen only (Analyser la position)
 */
import {
  emptyReaderGame,
  parseReaderPgn,
  readerGameFromImported,
  saveSharedGameSession,
  buildActiveLine,
  type SharedGameSession,
  type ReaderGame,
} from '../gameReader/index.ts';
import {
  buildAnalyzerHref,
  openPgnInAnalyzer,
  type AnalyzerHref,
} from './openPgnInAnalyzer.ts';
import type { GameLibraryStore } from './GameLibraryStore.ts';
import { pgnFromFenAndSans } from './pgnFromFenAndSans.ts';

export type ExerciseAnalyzerOpen = {
  gameId: string;
  href: AnalyzerHref;
  game: ReaderGame;
  session: SharedGameSession;
};

async function persistSession(input: {
  game: ReaderGame;
  currentNodeId: string | null;
  boardFlipped: boolean;
}): Promise<SharedGameSession> {
  const activeLineNodeIds = buildActiveLine(input.game, input.currentNodeId);
  return saveSharedGameSession({
    gameId: input.game.id,
    game: input.game,
    currentNodeId: input.currentNodeId,
    activeLineNodeIds,
    boardFlipped: input.boardFlipped,
    explorationOriginNodeId: null,
  });
}

function readerGameFromSetupPgn(pgnText: string, gameId?: string): ReaderGame | null {
  const parsed = parseReaderPgn(pgnText, { allowEmptyMoves: true, id: gameId });
  if (!parsed.ok) return null;
  return gameId ? { ...parsed.game, id: gameId } : parsed.game;
}

/**
 * Analyser la partie: initial FEN + every ply actually played, starting at the
 * root node so the full line is in the notation and navigation works.
 */
export async function openExerciseGameInAnalyzer(input: {
  startFen: string;
  moveSans: readonly string[];
  event: string;
  fileName: string;
  displayName: string;
  flipped?: boolean;
  resultTag?: string;
  extraHeaders?: Record<string, string>;
  store?: GameLibraryStore;
}): Promise<ExerciseAnalyzerOpen | null> {
  const pgnText = pgnFromFenAndSans({
    startFen: input.startFen,
    moveSans: input.moveSans,
    headers: {
      Event: input.event,
      Result: input.resultTag ?? '*',
      ...input.extraHeaders,
    },
  });

  const opened = await openPgnInAnalyzer({
    pgnText,
    fileName: input.fileName,
    displayName: input.displayName,
    flipped: input.flipped,
    tab: 'analysis',
    store: input.store,
  });
  if (!opened) return null;

  const game =
    readerGameFromSetupPgn(pgnText, opened.gameId) ??
    readerGameFromImported({
      id: opened.gameId,
      fingerprint: opened.game.fingerprint,
      headers: opened.game.headers,
      initialFen: opened.game.initialFen,
      moves: opened.game.moves,
      hasVariations: opened.game.hasVariations,
      rawPgn: opened.game.source.rawPgn,
      source: opened.game.source,
    });

  const session = await persistSession({
    game,
    currentNodeId: null,
    boardFlipped: Boolean(input.flipped),
  });

  return {
    gameId: opened.gameId,
    href: opened.href,
    game,
    session,
  };
}

/**
 * Analyser la position: load only the terminal FEN (pieces, castling, EP,
 * clocks, side to move). No attempt moves.
 */
export async function openExercisePositionInAnalyzer(input: {
  fen: string;
  flipped?: boolean;
}): Promise<ExerciseAnalyzerOpen | null> {
  const fen = input.fen.trim();
  if (!fen) return null;
  const game = emptyReaderGame(fen);
  if (game.initialFen !== fen) return null;

  const session = await persistSession({
    game,
    currentNodeId: null,
    boardFlipped: Boolean(input.flipped),
  });

  return {
    gameId: game.id,
    href: buildAnalyzerHref(game.id, {
      flipped: input.flipped,
      tab: 'analysis',
    }),
    game,
    session,
  };
}
