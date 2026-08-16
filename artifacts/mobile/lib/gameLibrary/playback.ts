/**
 * Pure playback cursor for Lecteur de parties (ply-based).
 * Timers / speech stay outside this module.
 */
import type { ImportedChessGame } from './types.ts';
import { fenAtPly, sanAtPly } from './importPgnGames.ts';

export type GamePlaybackSnapshot = {
  ply: number;
  totalPlies: number;
  fen: string;
  /** SAN of the last played ply, if ply > 0. */
  lastSan: string | null;
  isAtStart: boolean;
  isAtEnd: boolean;
};

export function createPlaybackSnapshot(
  game: ImportedChessGame,
  ply: number,
): GamePlaybackSnapshot {
  const totalPlies = game.moves.length;
  const safe = Math.max(0, Math.min(Math.floor(ply), totalPlies));
  return {
    ply: safe,
    totalPlies,
    fen: fenAtPly(game, safe),
    lastSan: sanAtPly(game, safe),
    isAtStart: safe === 0,
    isAtEnd: safe >= totalPlies,
  };
}

export function clampPly(game: ImportedChessGame, ply: number): number {
  return Math.max(0, Math.min(Math.floor(ply), game.moves.length));
}

export function nextPly(game: ImportedChessGame, ply: number): number {
  return clampPly(game, ply + 1);
}

export function previousPly(game: ImportedChessGame, ply: number): number {
  return clampPly(game, ply - 1);
}

/** Human-readable move label for the ply just reached (e.g. "17...Nf6"). */
export function formatPlyLabel(game: ImportedChessGame, ply: number): string {
  if (ply <= 0) return '—';
  const san = sanAtPly(game, ply);
  if (!san) return '—';
  const fullMove = Math.ceil(ply / 2);
  const isBlack = ply % 2 === 0;
  return isBlack ? `${fullMove}...${san}` : `${fullMove}.${san}`;
}
