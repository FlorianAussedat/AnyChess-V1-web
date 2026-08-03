export type {
  LocalPuzzle,
  PuzzleManifest,
  PuzzleSubmode,
  PuzzlePhase,
  PuzzleOrientation,
  PuzzleFilters,
  PuzzleAttemptResult,
  PuzzleAttemptStats,
  PuzzleHelpUsage,
  PuzzleHistoryRecord,
  PuzzleReplayMove,
} from './types.ts';
export {
  DEFAULT_PUZZLE_FILTERS,
  emptyPuzzleStats,
  finalizePuzzleStats,
  formatHelpsUsed,
  anyHelpUsed,
} from './types.ts';
export { filterBoardPieces, type PieceRevealFilter } from './boardDisplay.ts';

export { PuzzleRepository, puzzleRepository } from './PuzzleRepository.ts';
export { PuzzleHistoryStorage, puzzleHistoryStorage } from './PuzzleHistoryStorage.ts';
export { selectPuzzle, filterPuzzles, countPiecesAfterSetup } from './PuzzleSelector.ts';
export type { SelectPuzzleOptions, PuzzleSource } from './PuzzleSelector.ts';
export { PuzzleSession } from './PuzzleSession.ts';
export type { PuzzleSessionSnapshot, PuzzleAttemptOutcome } from './PuzzleSession.ts';
export {
  normalizeUci,
  uciFromSquares,
  isExpectedMove,
} from './PuzzleMoveValidator.ts';
export {
  narratePosition,
  narratePositionSpoken,
  frenchPieceName,
} from './PuzzlePositionNarrator.ts';
export {
  PuzzleSolutionReplay,
  PUZZLE_REPLAY_DELAY_MS,
} from './PuzzleSolutionReplay.ts';
export type { PuzzleSolutionReplayCallbacks } from './PuzzleSolutionReplay.ts';
export {
  PUZZLE_RATING_BANDS,
  PIECE_COUNT_BANDS,
  pieceCountMatchesBand,
} from './puzzleBands.ts';
export type { PuzzleRatingBand, PieceCountBand } from './puzzleBands.ts';
export {
  PuzzleStreakStore,
  puzzleStreakStore,
  applyStreakResult,
  emptyStreakState,
  PUZZLE_STREAK_STORAGE_KEY,
} from './PuzzleStreakStore.ts';
export type { PuzzleStreakState } from './PuzzleStreakStore.ts';
export { puzzleStreakBandId, formatStreakBandLabel } from './streakBand.ts';
