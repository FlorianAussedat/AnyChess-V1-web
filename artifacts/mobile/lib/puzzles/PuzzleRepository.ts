/**
 * Offline puzzle repository — imports the curated local JSON pack.
 *
 * Keeps a flat pack for simple offline bundling, plus a rating-band index so
 * selection does not repeatedly scan thousands of puzzles for every pick.
 * Suitable for a future Android migration (lazy per-band loading can replace
 * the flat import without changing callers).
 */
import type { LocalPuzzle, PuzzleFilters, PuzzleManifest } from './types.ts';
import { DEFAULT_PUZZLE_FILTERS } from './types.ts';
import {
  PUZZLE_RATING_BANDS,
  pieceCountMatchesBand,
  type PuzzleRatingBand,
} from './puzzleBands.ts';
import { filterPuzzles } from './PuzzleSelector.ts';
import puzzlesJson from './data/puzzles.json' with { type: 'json' };
import manifestJson from './data/manifest.json' with { type: 'json' };

const puzzles = puzzlesJson as LocalPuzzle[];
const manifest = manifestJson as PuzzleManifest;

const byId = new Map<string, LocalPuzzle>(puzzles.map((p) => [p.id, p]));

/** Pre-index concrete Elo bands (excludes `all`). */
const byBandId = new Map<string, LocalPuzzle[]>();
for (const band of PUZZLE_RATING_BANDS) {
  if (band.id === 'all') continue;
  byBandId.set(
    band.id,
    puzzles.filter((p) => p.rating >= band.ratingMin && p.rating <= band.ratingMax),
  );
}

function narrowByRating(filters: PuzzleFilters): LocalPuzzle[] {
  const covering: PuzzleRatingBand[] = [];
  for (const band of PUZZLE_RATING_BANDS) {
    if (band.id === 'all') continue;
    if (band.ratingMin >= filters.ratingMin && band.ratingMax <= filters.ratingMax) {
      covering.push(band);
    }
  }

  if (
    covering.length > 0 &&
    covering[0]!.ratingMin === filters.ratingMin &&
    covering[covering.length - 1]!.ratingMax === filters.ratingMax
  ) {
    if (covering.length === 1) {
      return byBandId.get(covering[0]!.id) ?? [];
    }
    const out: LocalPuzzle[] = [];
    for (const band of covering) {
      const list = byBandId.get(band.id);
      if (list) out.push(...list);
    }
    return out;
  }

  // Exact single-band match even when bounds differ slightly from table edges.
  for (const band of PUZZLE_RATING_BANDS) {
    if (band.id === 'all') continue;
    if (band.ratingMin === filters.ratingMin && band.ratingMax === filters.ratingMax) {
      return byBandId.get(band.id) ?? [];
    }
  }

  return puzzles.filter(
    (p) => p.rating >= filters.ratingMin && p.rating <= filters.ratingMax,
  );
}

export class PuzzleRepository {
  getAll(): LocalPuzzle[] {
    return puzzles;
  }

  getById(id: string): LocalPuzzle | undefined {
    return byId.get(id);
  }

  /** Puzzles pre-bucketed for a concrete Elo band id (not `all`). */
  getByBandId(bandId: string): LocalPuzzle[] {
    if (bandId === 'all') return puzzles;
    return byBandId.get(bandId) ?? [];
  }

  /**
   * Filter without forcing callers to hold the full pack in UI state.
   * Applies rating via the band index, then theme / piece-count filters.
   */
  query(filters: Partial<PuzzleFilters> = {}): LocalPuzzle[] {
    const full: PuzzleFilters = { ...DEFAULT_PUZZLE_FILTERS, ...filters };
    const rated = narrowByRating(full);
    // Reuse shared filter for theme / piece-count / move sanity on the narrowed set.
    return filterPuzzles(rated, {
      ...full,
      // Rating already applied; keep bounds so filterPuzzles stays correct.
      ratingMin: full.ratingMin,
      ratingMax: full.ratingMax,
    });
  }

  count(): number {
    return puzzles.length;
  }

  countInBand(bandId: string): number {
    return this.getByBandId(bandId).length;
  }

  getManifest(): PuzzleManifest {
    return manifest;
  }

  /** Band occupancy for diagnostics / tests. */
  bandCounts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const band of PUZZLE_RATING_BANDS) {
      if (band.id === 'all') continue;
      out[band.id] = byBandId.get(band.id)?.length ?? 0;
    }
    return out;
  }
}

/** Shared singleton for the embedded offline pack. */
export const puzzleRepository = new PuzzleRepository();
