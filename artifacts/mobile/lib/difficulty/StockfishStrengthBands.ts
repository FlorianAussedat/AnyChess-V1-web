/**
 * Classic-game Stockfish strength bands (approximate opponent Elo).
 * Uses UCI_LimitStrength + UCI_Elo — not search-speed throttling.
 *
 * Note: Stockfish clamps UCI_Elo to MIN_UCI_ELO (1320). Bands targeting below
 * that still request the clamped floor; GameContext then raises multiPv /
 * varietyMarginCp so those opponents still play with more variety / weaker feel.
 */

export interface StockfishStrengthBand {
  id: string;
  label: string;
  /** Target Elo sent to Stockfish (clamped by engine limits later). */
  targetElo: number;
  /** Inclusive display range (null = open-ended). */
  minRating: number | null;
  maxRating: number | null;
}

export const STOCKFISH_STRENGTH_BANDS: StockfishStrengthBand[] = [
  { id: 'lt800', label: '<800', targetElo: 700, minRating: null, maxRating: 799 },
  { id: '800-1000', label: '800–1000', targetElo: 900, minRating: 800, maxRating: 1000 },
  { id: '1000-1200', label: '1000–1200', targetElo: 1100, minRating: 1000, maxRating: 1200 },
  { id: '1200-1400', label: '1200–1400', targetElo: 1300, minRating: 1200, maxRating: 1400 },
  { id: '1400-1600', label: '1400–1600', targetElo: 1500, minRating: 1400, maxRating: 1600 },
  { id: '1600-1800', label: '1600–1800', targetElo: 1700, minRating: 1600, maxRating: 1800 },
  { id: '1800-2000', label: '1800–2000', targetElo: 1900, minRating: 1800, maxRating: 2000 },
  { id: '2000-2200', label: '2000–2200', targetElo: 2100, minRating: 2000, maxRating: 2200 },
  { id: 'gt2200', label: '>2200', targetElo: 2400, minRating: 2201, maxRating: null },
];

export const DEFAULT_STRENGTH_BAND_ID = '1600-1800';

export function getStrengthBand(id: string): StockfishStrengthBand {
  return (
    STOCKFISH_STRENGTH_BANDS.find((b) => b.id === id) ??
    STOCKFISH_STRENGTH_BANDS.find((b) => b.id === DEFAULT_STRENGTH_BAND_ID)!
  );
}

/**
 * Small natural variation around the band centre so consecutive games
 * feel slightly different while staying in-range.
 */
export function eloForBand(
  band: StockfishStrengthBand,
  rng: () => number = Math.random,
): number {
  const jitter = Math.round((rng() - 0.5) * 80); // ±40
  return Math.max(400, band.targetElo + jitter);
}
