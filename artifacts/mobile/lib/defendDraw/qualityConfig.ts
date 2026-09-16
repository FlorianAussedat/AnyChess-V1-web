/**
 * Centralized quality / training thresholds for endgame pool curation.
 * Documented here so offline filters and reports stay aligned.
 */
export const ENDGAME_QUALITY_CONFIG = {
  /** Reject if kings-only (or insufficient material) within this many plies under best-effort play. */
  maxTerminalPlies: 6,
  /** Soft reject if major material can be liquidated within this many plies. */
  maxLiquidationPlies: 4,
  /** Max fraction of a difficulty band that one family may occupy when alternatives exist. */
  maxFamilySharePerBand: 0.65,
  /** Max near-duplicates allowed per similarity key within a band. */
  maxSimilarPerBand: 6,
  /** Minimum practicalPressure to keep a position (0–100). */
  minPracticalPressure: 25,
  /** Minimum qualityScore to keep (0–100). Soft signal when other rejects exist. */
  minQualityScore: 30,
  /** Drawing ratio above which a position is considered soft / low interest. */
  softDrawingRatio: 0.7,
  /** Soft if drawingMoves is at least this AND ratio ≥ softDrawingRatio AND no unique moments. */
  softDrawingMovesMin: 10,
  /** Reject bare QvQ / RvR with no pawns unless qualityOverride.keep. */
  rejectBareHeavySymmetry: true,
} as const;

/**
 * Runtime opponent policy thresholds (practical-pressure).
 * All evaluations are normalized from Stockfish's perspective.
 */
export const PRACTICAL_PRESSURE_CONFIG = {
  multiPv: 5,
  /** Approx think time for MultiPV search (ms). */
  thinkTimeMs: 1000,
  /** Max CP gap from best move to stay in the candidate set. */
  maxCpGapFromBest: 30,
  /** Reject candidates that give the player a forced mate against Stockfish. */
  rejectSelfMate: true,
} as const;

export type EndgameTrainingStyle = 'technical' | 'practical' | 'critical';

export type EndgameQualityMetrics = {
  immediateLiquidation: boolean;
  terminalWithinPlies: number | null;
  materialReductionWithinPlies: number;
  practicalPressure: number;
  similarityKey: string;
  qualityScore: number;
  rejectionReasons: string[];
};

export type EndgameQualityOverride = {
  keep: true;
  reason: string;
};

export type EndgameOpponentPolicy = 'strict-best' | 'practical-pressure';
