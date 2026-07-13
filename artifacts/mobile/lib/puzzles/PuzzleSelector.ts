/**
 * Random puzzle selection with rating / theme / piece-count filters
 * and recent-ID avoidance.
 */
import { Chess } from 'chess.js';
import type { LocalPuzzle, PuzzleFilters } from './types';
import { DEFAULT_PUZZLE_FILTERS } from './types';
import { puzzleRepository, type PuzzleRepository } from './PuzzleRepository';

export interface SelectPuzzleOptions {
  filters?: Partial<PuzzleFilters>;
  /** Puzzle IDs to avoid (recent history). */
  excludeIds?: string[];
  /** Optional RNG seed for deterministic picks. */
  seed?: number;
  repository?: PuzzleRepository;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pieceCountOnBoard(fen: string, setupUci: string | undefined): number | null {
  try {
    const game = new Chess(fen);
    if (setupUci && setupUci.length >= 4) {
      const from = setupUci.slice(0, 2);
      const to = setupUci.slice(2, 4);
      const promotion = setupUci.slice(4) || undefined;
      game.move({ from, to, promotion });
    }
    let n = 0;
    for (const row of game.board()) {
      for (const cell of row) {
        if (cell) n += 1;
      }
    }
    return n;
  } catch {
    return null;
  }
}

export function filterPuzzles(
  all: LocalPuzzle[],
  filters: PuzzleFilters,
): LocalPuzzle[] {
  const themeSet =
    filters.themes && filters.themes.length > 0
      ? new Set(filters.themes)
      : null;

  return all.filter((p) => {
    if (p.rating < filters.ratingMin || p.rating > filters.ratingMax) return false;
    if (p.moves.length < 2) return false;
    if (themeSet) {
      const hit = p.themes.some((t) => themeSet.has(t));
      if (!hit) return false;
    }
    if (filters.pieceCount != null) {
      const count = pieceCountOnBoard(p.fen, p.moves[0]);
      if (count !== filters.pieceCount) return false;
    }
    return true;
  });
}

/**
 * Pick a random puzzle matching filters, preferring ones not in excludeIds.
 * Falls back to the filtered pool (including recent) if everything was excluded.
 */
export function selectPuzzle(options: SelectPuzzleOptions = {}): LocalPuzzle | null {
  const repo = options.repository ?? puzzleRepository;
  const filters: PuzzleFilters = {
    ...DEFAULT_PUZZLE_FILTERS,
    ...options.filters,
  };
  const all = filterPuzzles(repo.getAll(), filters);
  if (all.length === 0) return null;

  const exclude = new Set(options.excludeIds ?? []);
  const fresh = all.filter((p) => !exclude.has(p.id));
  const pool = fresh.length > 0 ? fresh : all;

  const rand =
    options.seed != null ? mulberry32(options.seed) : () => Math.random();
  const index = Math.floor(rand() * pool.length);
  return pool[index] ?? null;
}
