/**
 * Puzzle / Visualization mode — pure types (no UI / React).
 */

/** Compact offline puzzle (Lichess-derived). */
export interface LocalPuzzle {
  id: string;
  /** Source FEN before the opponent setup move (moves[0]). */
  fen: string;
  /** UCI moves: [setup, user, opponent, user, …]. */
  moves: string[];
  rating: number;
  popularity: number;
  themes: string[];
  openingTags?: string[];
}

export interface PuzzleManifest {
  version: number;
  generatedAt?: string;
  count: number;
  ratingMin: number;
  ratingMax: number;
  seed?: number;
  notes?: string;
  sourceUrl?: string;
  license?: string;
  bands?: Array<{
    id: string;
    label: string;
    min: number;
    max: number;
    target: number;
    count: number;
  }>;
}

export type PuzzleSubmode = 'visual' | 'blind';

export type PuzzlePhase = 'hub' | 'playing' | 'results' | 'solution-replay';

/** Board orientation: side at the bottom of the board. */
export type PuzzleOrientation = 'w' | 'b';

export interface PuzzleFilters {
  ratingMin: number;
  ratingMax: number;
  /** Theme ids; empty / undefined = any. */
  themes?: string[];
  /** Exact piece count after setup, when set. */
  pieceCount?: number;
  /** Inclusive min piece count after setup (band). */
  pieceCountMin?: number | null;
  /** Inclusive max piece count after setup (band). */
  pieceCountMax?: number | null;
}

export const DEFAULT_PUZZLE_FILTERS: PuzzleFilters = {
  // "Aléatoire / Tous" — pack spans the curated multi-Elo bands.
  ratingMin: 0,
  ratingMax: 4000,
  pieceCountMin: null,
  pieceCountMax: null,
};

export type PuzzleAttemptResult =
  | 'correct'
  | 'wrong-legal'
  | 'illegal'
  | 'recognition-failure'
  | 'complete';

export interface PuzzleHelpUsage {
  /** First-time White piece reveal (counts as one index). */
  whiteReveal: boolean;
  /** First-time Black piece reveal (counts as one index). */
  blackReveal: boolean;
  solution: boolean;
  /**
   * Position replay used — free training action (not an index).
   * Kept for analytics only; does not void streak / clean solve.
   */
  positionRepeat: boolean;
  /** At least one "Coup suivant" reveal. */
  nextMove: boolean;
}

export interface PuzzleAttemptStats {
  solved: boolean;
  solvedWithoutHelp: boolean;
  /** True when every user plie was correct on the first try. */
  firstAttemptSuccess: boolean;
  wrongChessMoves: number;
  recognitionFailures: number;
  solutionRequested: boolean;
  helps: PuzzleHelpUsage;
  /** Number of times "Coup suivant" was used (each counts as an index). */
  nextMoveUses: number;
  /** Number of user plies in the solution line. */
  userMoveCount: number;
  correctOnFirstAttempt: number;
  accuracyPercent: number;
}

export interface PuzzleHistoryRecord {
  puzzleId: string;
  playedAt: string;
  solved: boolean;
  solvedWithoutHelp: boolean;
  firstAttemptSuccess: boolean;
  wrongChessMoves: number;
  recognitionFailures: number;
  solutionRequested: boolean;
  themes: string[];
  rating: number;
}

/** One half-move for solution replay / highlighting. */
export interface PuzzleReplayMove {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  uci: string;
  verbal: string;
  color: 'w' | 'b';
}

export function emptyPuzzleStats(userMoveCount = 0): PuzzleAttemptStats {
  return {
    solved: false,
    solvedWithoutHelp: true,
    firstAttemptSuccess: true,
    wrongChessMoves: 0,
    recognitionFailures: 0,
    solutionRequested: false,
    helps: {
      whiteReveal: false,
      blackReveal: false,
      solution: false,
      positionRepeat: false,
      nextMove: false,
    },
    nextMoveUses: 0,
    userMoveCount,
    correctOnFirstAttempt: 0,
    accuracyPercent: userMoveCount === 0 ? 0 : 0,
  };
}

/**
 * True when any streak-disqualifying help was used.
 * Position repeat is free and does not count.
 */
export function anyHelpUsed(helps: PuzzleHelpUsage): boolean {
  return (
    helps.whiteReveal ||
    helps.blackReveal ||
    helps.solution ||
    helps.nextMove
  );
}

/** @deprecated Prefer countPuzzleIndices for user-facing metrics. */
export function formatHelpsUsed(helps: PuzzleHelpUsage): string {
  const parts: string[] = [];
  if (helps.whiteReveal) parts.push('pièces blanches');
  if (helps.blackReveal) parts.push('pièces noires');
  if (helps.nextMove) parts.push('coup suivant');
  if (helps.solution) parts.push('solution');
  return parts.length ? parts.join(', ') : 'aucune';
}

export function finalizePuzzleStats(stats: PuzzleAttemptStats): PuzzleAttemptStats {
  const accuracyPercent =
    stats.userMoveCount === 0
      ? 0
      : Math.round((stats.correctOnFirstAttempt / stats.userMoveCount) * 100);
  const indexHelp =
    helpsAsIndexDisqualifier(stats.helps) || stats.nextMoveUses > 0;
  return {
    ...stats,
    accuracyPercent,
    firstAttemptSuccess:
      stats.userMoveCount > 0 &&
      stats.correctOnFirstAttempt === stats.userMoveCount &&
      !stats.solutionRequested,
    solvedWithoutHelp:
      stats.solved && !stats.solutionRequested && !indexHelp,
  };
}

function helpsAsIndexDisqualifier(helps: PuzzleHelpUsage): boolean {
  return helps.whiteReveal || helps.blackReveal || helps.nextMove || helps.solution;
}
