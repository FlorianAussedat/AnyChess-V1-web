/**
 * Opening training line enumeration via the shared GameTree (ReaderGame).
 *
 * Openings still build a position-keyed repertoire DAG for move validation /
 * transposition collapse (`buildRepertoire`). Path enumeration for revision
 * MUST walk the recursive PGN tree — never a flattened main-line projection.
 */
import { parseReaderPgn } from '../gameReader/parseReaderPgn.ts';
import {
  getAllRootToLeafLines,
  getChildSansAtFen,
  getGameTreeStats,
  type GameTreeLine,
  type GameTreeStats,
} from '../gameTree/index.ts';
import type { ReaderGame } from '../gameReader/types.ts';

export type TrainingLinesResult = {
  ok: true;
  game: ReaderGame;
  lines: GameTreeLine[];
  stats: GameTreeStats;
};

export type TrainingLinesError = {
  ok: false;
  detail: string;
};

/**
 * Parse a repertoire PGN with the shared reader GameTree and enumerate every
 * root→leaf path (including nested variations of arbitrary depth).
 */
export function getAllTrainingLinesFromPgn(
  pgn: string,
): TrainingLinesResult | TrainingLinesError {
  const parsed = parseReaderPgn(pgn, { allowEmptyMoves: true });
  if (!parsed.ok) {
    return {
      ok: false,
      detail: parsed.detail ?? parsed.error ?? 'parse-failed',
    };
  }
  const lines = getAllRootToLeafLines(parsed.game);
  return {
    ok: true,
    game: parsed.game,
    lines,
    stats: getGameTreeStats(parsed.game),
  };
}

/** Valid repertoire SANs at a FEN, from the shared tree. */
export function getValidRepertoireSansAtFen(
  game: ReaderGame,
  fen: string,
): string[] {
  return getChildSansAtFen(game, fen);
}

export type { GameTreeLine, GameTreeStats };
