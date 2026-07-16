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
}

export const DEFAULT_PUZZLE_FILTERS: PuzzleFilters = {
  // Pack window for ~1800 Chess.com target (see PlayerDifficultyProfile).
  ratingMin: 1600,
  ratingMax: 2200,
};

export type PuzzleAttemptResult =
  | 'correct'
  | 'wrong-legal'
  | 'illegal'
  | 'recognition-failure'
  | 'complete';

export interface PuzzleHelpUsage {
  whiteReveal: boolean;
  blackReveal: boolean;
  solution: boolean;
  positionRepeat: boolean;
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
    },
    userMoveCount,
    correctOnFirstAttempt: 0,
    accuracyPercent: userMoveCount === 0 ? 0 : 0,
  };
}

export function anyHelpUsed(helps: PuzzleHelpUsage): boolean {
  return helps.whiteReveal || helps.blackReveal || helps.solution || helps.positionRepeat;
}

export function formatHelpsUsed(helps: PuzzleHelpUsage): string {
  const parts: string[] = [];
  if (helps.whiteReveal) parts.push('pièces blanches');
  if (helps.blackReveal) parts.push('pièces noires');
  if (helps.solution) parts.push('solution');
  if (helps.positionRepeat) parts.push('répétition position');
  return parts.length ? parts.join(', ') : 'aucune';
}

export function finalizePuzzleStats(stats: PuzzleAttemptStats): PuzzleAttemptStats {
  const accuracyPercent =
    stats.userMoveCount === 0
      ? 0
      : Math.round((stats.correctOnFirstAttempt / stats.userMoveCount) * 100);
  return {
    ...stats,
    accuracyPercent,
    firstAttemptSuccess:
      stats.userMoveCount > 0 &&
      stats.correctOnFirstAttempt === stats.userMoveCount &&
      !stats.solutionRequested,
    solvedWithoutHelp: stats.solved && !stats.solutionRequested && !anyHelpUsed(stats.helps),
  };
}
