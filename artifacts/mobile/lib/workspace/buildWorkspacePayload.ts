import { Chess } from 'chess.js';
import type { ImportedChessGame } from '../gameLibrary/types.ts';
import type { ChessWorkspacePayload, EngineEvaluation, WorkspaceMove } from './types.ts';

function sideFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function evalFromScore(scoreCp: number, mateIn: number | null): EngineEvaluation {
  if (typeof mateIn === 'number' && Number.isFinite(mateIn)) {
    return {
      type: 'mate',
      value: mateIn,
      perspective: 'white',
    };
  }
  return {
    type: 'cp',
    value: scoreCp,
    perspective: 'white',
  };
}

export function workspacePayloadFromImportedGame(input: {
  game: ImportedChessGame;
  orientation: 'white' | 'black';
  source?: ChessWorkspacePayload['source'];
  mode?: ChessWorkspacePayload['workspaceMode'];
  title: string;
  subtitle?: string;
  result?: ChessWorkspacePayload['result'];
  evaluations?: Array<{ ply: number; scoreCp: number; mateIn: number | null }>;
  markers?: ChessWorkspacePayload['markers'];
}): ChessWorkspacePayload {
  const moves: WorkspaceMove[] = [];
  let currentFen = input.game.initialFen;
  for (const move of input.game.moves) {
    moves.push({
      ply: move.ply,
      san: move.san,
      fenBefore: currentFen,
      fenAfter: move.fenAfter,
      playedBy: sideFromFen(currentFen),
      comment: move.comment,
    });
    currentFen = move.fenAfter;
  }
  return {
    schemaVersion: 1,
    workspaceMode: input.mode ?? 'reader',
    source: input.source ?? 'manual-pgn',
    title: input.title,
    subtitle: input.subtitle,
    initialFen: input.game.initialFen,
    pgn: input.game.source.rawPgn,
    moves,
    orientation: input.orientation,
    result: input.result,
    evaluations: input.evaluations?.map((entry) => ({
      ply: entry.ply,
      evaluation: evalFromScore(entry.scoreCp, entry.mateIn),
    })),
    markers: input.markers,
    metadata: {
      gameId: input.game.id,
      hasVariations: input.game.hasVariations,
      headers: input.game.headers,
    },
  };
}

export function workspacePayloadFromFen(input: {
  fen: string;
  title: string;
  subtitle?: string;
  orientation?: 'white' | 'black';
  mode?: ChessWorkspacePayload['workspaceMode'];
}): ChessWorkspacePayload {
  new Chess(input.fen);
  return {
    schemaVersion: 1,
    workspaceMode: input.mode ?? 'free-play',
    source: 'manual-fen',
    title: input.title,
    subtitle: input.subtitle,
    initialFen: input.fen,
    moves: [],
    orientation: input.orientation ?? sideFromFen(input.fen),
  };
}
