/**
 * Puzzle difficulty bands based on Lichess ratings (no Chess.com conversion).
 *
 * Ranges are closed and non-overlapping so a puzzle rating maps to exactly one
 * band (except `all`). Labels match the Elo ranges offered in the tactics UI.
 *
 * Keep this list data-driven so we can later:
 * - add/remove bands
 * - change DEFAULT_PUZZLE_RATING_BAND_ID
 * - map a profile Elo onto a default band
 * - add adaptive difficulty without redesigning selection
 */
export interface PuzzleRatingBand {
  id: string;
  label: string;
  /** Inclusive lower bound (Lichess puzzle rating). */
  ratingMin: number;
  /** Inclusive upper bound (Lichess puzzle rating). */
  ratingMax: number;
}

/**
 * Default hub selection. Prefer `all` until profile Elo / adaptive difficulty
 * lands; swap this constant without touching selection logic.
 */
export const DEFAULT_PUZZLE_RATING_BAND_ID = 'all';

export const PUZZLE_RATING_BANDS: PuzzleRatingBand[] = [
  { id: '600-799', label: '600–799', ratingMin: 600, ratingMax: 799 },
  { id: '800-999', label: '800–999', ratingMin: 800, ratingMax: 999 },
  { id: '1000-1199', label: '1000–1199', ratingMin: 1000, ratingMax: 1199 },
  { id: '1200-1399', label: '1200–1399', ratingMin: 1200, ratingMax: 1399 },
  { id: '1400-1599', label: '1400–1599', ratingMin: 1400, ratingMax: 1599 },
  { id: '1600-1799', label: '1600–1799', ratingMin: 1600, ratingMax: 1799 },
  { id: '1800-1999', label: '1800–1999', ratingMin: 1800, ratingMax: 1999 },
  { id: '2000-2199', label: '2000–2199', ratingMin: 2000, ratingMax: 2199 },
  { id: '2200+', label: '2200+', ratingMin: 2200, ratingMax: 4000 },
  { id: 'all', label: 'Aléatoire / Tous', ratingMin: 0, ratingMax: 4000 },
];

/** Resolve a band id; falls back to the configured default. */
export function getPuzzleRatingBand(bandId: string): PuzzleRatingBand {
  return (
    PUZZLE_RATING_BANDS.find((b) => b.id === bandId) ??
    PUZZLE_RATING_BANDS.find((b) => b.id === DEFAULT_PUZZLE_RATING_BAND_ID)!
  );
}

/** Map a Lichess puzzle rating onto a concrete Elo band (never `all`). */
export function puzzleBandForRating(rating: number): PuzzleRatingBand | undefined {
  return PUZZLE_RATING_BANDS.find(
    (b) => b.id !== 'all' && rating >= b.ratingMin && rating <= b.ratingMax,
  );
}

export interface PieceCountBand {
  id: string;
  label: string;
  /** Inclusive min; null = open. */
  min: number | null;
  /** Inclusive max; null = open. */
  max: number | null;
}

export const DEFAULT_PIECE_COUNT_BAND_ID = 'all';

export const PIECE_COUNT_BANDS: PieceCountBand[] = [
  { id: 'le5', label: '≤5', min: null, max: 5 },
  { id: '6-7', label: '6–7', min: 6, max: 7 },
  { id: '8-9', label: '8–9', min: 8, max: 9 },
  { id: '10-12', label: '10–12', min: 10, max: 12 },
  { id: '13-15', label: '13–15', min: 13, max: 15 },
  { id: 'gt15', label: '>15', min: 16, max: null },
  { id: 'all', label: 'Tous', min: null, max: null },
];

export function pieceCountMatchesBand(
  count: number,
  band: PieceCountBand,
): boolean {
  if (band.id === 'all') return true;
  if (band.min != null && count < band.min) return false;
  if (band.max != null && count > band.max) return false;
  return true;
}
