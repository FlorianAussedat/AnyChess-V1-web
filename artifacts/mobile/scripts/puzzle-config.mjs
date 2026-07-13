/**
 * Puzzle dataset filter / selection configuration.
 * Adjust these values and re-run `node scripts/build-puzzle-dataset.mjs`.
 */
export const PUZZLE_BUILD_CONFIG = {
  /** Official source (CC0): https://database.lichess.org/#puzzles */
  sourceUrl: 'https://database.lichess.org/lichess_db_puzzle.csv.zst',
  sourceLicense: 'CC0',

  /** Lichess puzzle rating band (not a Chess.com conversion). */
  minRating: 1600,
  maxRating: 2200,

  popularityMin: 70,
  nbPlaysMin: 100,
  ratingDeviationMax: 100,

  /** Hard cap for the embedded package. */
  maxPuzzles: 10_000,

  /** Deterministic selection seed — keep stable to regenerate the same pack. */
  selectionSeed: 20260713,

  /**
   * Themes used for diversity balancing. Only identifiers that exist in the
   * Lichess puzzle database should appear here.
   */
  themeBuckets: [
    'mate',
    'mateIn1',
    'mateIn2',
    'mateIn3',
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'doubleCheck',
    'deflection',
    'decoy',
    'sacrifice',
    'clearance',
    'interference',
    'attraction',
    'trappedPiece',
    'hangingPiece',
    'advancedPawn',
    'promotion',
    'backRankMate',
    'smotheredMate',
    'defensiveMove',
    'quietMove',
    'endgame',
    'rookEndgame',
    'pawnEndgame',
    'crushing',
    'advantage',
  ],

  /** Soft per-theme cap so common themes cannot monopolise the pack. */
  maxSharePerTheme: 0.12,
};

/** Alias used by docs / reports. */
export default PUZZLE_BUILD_CONFIG;
