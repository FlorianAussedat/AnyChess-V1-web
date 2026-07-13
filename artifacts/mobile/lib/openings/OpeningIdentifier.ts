/**
 * Live opening identification from a local ECO dataset (lichess chess-openings, CC0).
 *
 * Completely independent from user-imported PGN repertoires: this module only
 * names the position being played. It never influences Stockfish or book play.
 */
import { Chess } from 'chess.js';
import openingsData from './data/openings.json';

export interface OpeningIdentity {
  eco: string;
  name: string;
  /** Half-move depth of the matched opening definition. */
  ply: number;
}

type OpeningEntry = { eco: string; name: string; ply: number };
type OpeningIndex = Record<string, OpeningEntry>;

const index: OpeningIndex = openingsData as OpeningIndex;

/** Position key = FEN without halfmove/fullmove counters (transposition-safe). */
export function openingPositionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

/**
 * Identify the deepest known opening along a SAN move list.
 * If the game later leaves the book, the last recognised match is kept.
 */
export function identifyOpeningFromSans(sans: string[]): OpeningIdentity | null {
  if (!sans.length) return null;

  const game = new Chess();
  let best: OpeningIdentity | null = null;

  for (const san of sans) {
    try {
      const moved = game.move(san);
      if (!moved) break;
    } catch {
      break;
    }
    const hit = index[openingPositionKey(game.fen())];
    if (hit) {
      best = { eco: hit.eco, name: hit.name, ply: hit.ply };
    }
  }

  return best;
}

/** Look up a single position (no history). */
export function identifyOpeningFromFen(fen: string): OpeningIdentity | null {
  const hit = index[openingPositionKey(fen)];
  return hit ? { eco: hit.eco, name: hit.name, ply: hit.ply } : null;
}

export function openingIndexSize(): number {
  return Object.keys(index).length;
}
