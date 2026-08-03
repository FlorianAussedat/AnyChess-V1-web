/**
 * Puzzle dataset filter / selection configuration.
 * Adjust these values and re-run `node scripts/build-puzzle-dataset.mjs`.
 *
 * Elo bands are the single source of truth for the curated pack targets.
 * App UI bands in `lib/puzzles/puzzleBands.ts` mirror these ranges.
 */
export const PUZZLE_BUILD_CONFIG = {
  /** Official source (CC0): https://database.lichess.org/#puzzles */
  sourceUrl: 'https://database.lichess.org/lichess_db_puzzle.csv.zst',
  sourceLicense: 'CC0',

  /**
   * Target Elo ranges for the embedded offline pack.
   * Closed inclusive ranges; `2200+` is open-ended on the high side.
   */
  ratingBands: [
    { id: '600-799', label: '600–799', min: 600, max: 799, target: 500 },
    { id: '800-999', label: '800–999', min: 800, max: 999, target: 500 },
    { id: '1000-1199', label: '1000–1199', min: 1000, max: 1199, target: 500 },
    { id: '1200-1399', label: '1200–1399', min: 1200, max: 1399, target: 500 },
    { id: '1400-1599', label: '1400–1599', min: 1400, max: 1599, target: 500 },
    { id: '1600-1799', label: '1600–1799', min: 1600, max: 1799, target: 500 },
    { id: '1800-1999', label: '1800–1999', min: 1800, max: 1999, target: 500 },
    { id: '2000-2199', label: '2000–2199', min: 2000, max: 2199, target: 500 },
    { id: '2200+', label: '2200+', min: 2200, max: 4000, target: 500 },
  ],

  /** Overall rating window accepted while scanning the Lichess dump. */
  minRating: 600,
  maxRating: 4000,

  popularityMin: 50,
  nbPlaysMin: 50,
  ratingDeviationMax: 120,

  /** Soft ceiling across all bands (sum of targets + small headroom). */
  maxPuzzles: 4_600,

  /** Deterministic selection seed — keep stable to regenerate the same pack. */
  selectionSeed: 20260803,

  /**
   * Themes used for diversity balancing. Only identifiers that exist in the
   * Lichess puzzle database should appear here.
   */
  themeBuckets: [
    'mate',
    'mateIn1',
    'mateIn2',
    'mateIn3',
    'backRankMate',
    'smotheredMate',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'discoveredCheck',
    'doubleCheck',
    'deflection',
    'decoy',
    'sacrifice',
    'clearance',
    'interference',
    'attraction',
    'trappedPiece',
    'hangingPiece',
    'capturingDefender',
    'advancedPawn',
    'promotion',
    'defensiveMove',
    'quietMove',
    'intermezzo',
    'endgame',
    'rookEndgame',
    'pawnEndgame',
    'crushing',
    'advantage',
  ],

  /**
   * Soft per-theme share within each Elo band so common themes cannot
   * monopolise that band's ~500 puzzles.
   */
  maxSharePerTheme: 0.18,

  /** Candidate pool size multiplier per band before final validation/selection. */
  candidateMultiplier: 8,
};

/** Alias used by docs / reports. */
export default PUZZLE_BUILD_CONFIG;
