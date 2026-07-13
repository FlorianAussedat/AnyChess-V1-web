export type {
  LocalPuzzle,
  PuzzleManifest,
  PuzzleSubmode,
  PuzzlePhase,
  PuzzleOrientation,
  PuzzleFilters,
  PuzzleAttemptResult,
  PuzzleAttemptStats,
  PuzzleHistoryRecord,
  PuzzleReplayMove,
} from './types';
export {
  DEFAULT_PUZZLE_FILTERS,
  emptyPuzzleStats,
  finalizePuzzleStats,
} from './types';

export { PuzzleRepository, puzzleRepository } from './PuzzleRepository';
export { PuzzleHistoryStorage, puzzleHistoryStorage } from './PuzzleHistoryStorage';
export { selectPuzzle, filterPuzzles } from './PuzzleSelector';
export type { SelectPuzzleOptions } from './PuzzleSelector';
export { PuzzleSession } from './PuzzleSession';
export type { PuzzleSessionSnapshot, PuzzleAttemptOutcome } from './PuzzleSession';
export {
  normalizeUci,
  uciFromSquares,
  isExpectedMove,
} from './PuzzleMoveValidator';
export {
  narratePosition,
  narratePositionSpoken,
  frenchPieceName,
} from './PuzzlePositionNarrator';
export {
  PuzzleSolutionReplay,
  PUZZLE_REPLAY_DELAY_MS,
} from './PuzzleSolutionReplay';
export type { PuzzleSolutionReplayCallbacks } from './PuzzleSolutionReplay';
