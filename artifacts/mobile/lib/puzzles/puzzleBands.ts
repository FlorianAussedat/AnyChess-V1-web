/**
 * Puzzle difficulty bands based on Lichess ratings (no Chess.com conversion).
 *
 * Filter ranges are half-open / non-overlapping so a puzzle rating maps to
 * exactly one band (except `all`). Display labels keep friendly closed ranges
 * (e.g. "800–1000") while filters use 800–999, etc.
 */
export interface PuzzleRatingBand {
  id: string;
  label: string;
  ratingMin: number;
  ratingMax: number;
}

export const PUZZLE_RATING_BANDS: PuzzleRatingBand[] = [
  { id: 'lt800', label: '<800', ratingMin: 0, ratingMax: 799 },
  { id: '800-1000', label: '800–1000', ratingMin: 800, ratingMax: 999 },
  { id: '1000-1200', label: '1000–1200', ratingMin: 1000, ratingMax: 1199 },
  { id: '1200-1400', label: '1200–1400', ratingMin: 1200, ratingMax: 1399 },
  { id: '1400-1600', label: '1400–1600', ratingMin: 1400, ratingMax: 1599 },
  { id: '1600-1800', label: '1600–1800', ratingMin: 1600, ratingMax: 1799 },
  { id: '1800-2000', label: '1800–2000', ratingMin: 1800, ratingMax: 1999 },
  { id: '2000-2200', label: '2000–2200', ratingMin: 2000, ratingMax: 2200 },
  { id: 'gt2200', label: '>2200', ratingMin: 2201, ratingMax: 4000 },
  { id: 'all', label: 'Aléatoire / Tous', ratingMin: 0, ratingMax: 4000 },
];

export interface PieceCountBand {
  id: string;
  label: string;
  /** Inclusive min; null = open. */
  min: number | null;
  /** Inclusive max; null = open. */
  max: number | null;
}

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
