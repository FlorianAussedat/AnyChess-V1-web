/**
 * Opening-repertoire module — public surface.
 *
 * Independent of Stockfish and the UI. Turns PGN text (main lines + nested
 * variations + comments, one opening per file or many) into a position-keyed
 * move tree that supports transpositions, then lets a caller choose a book
 * move for the current position or detect that play has left the repertoire.
 *
 * Persistence (folders + PGN files) lives behind RepertoireStorage so the
 * Android build can swap the backend later. RepertoireService is the only
 * API the UI should call for CRUD + merged-tree building.
 */
export {
  buildRepertoire,
  chooseRepertoireMove,
  hasPosition,
  movesForPosition,
  positionKey,
  DEFAULT_FEN,
} from './repertoireTree';
export { parsePgn, tokenize, splitGames, PgnSyntaxError } from './pgnParser';
export type { PgnGame, PgnMoveNode } from './pgnParser';
export type {
  ParsedRepertoire,
  RepertoireIssue,
  RepertoireMoveChoice,
  RepertoireNode,
  RepertoireSelectionMode,
  RepertoireSelectionSettings,
  PgnHeaders,
} from './types';
export {
  RepertoireService,
  repertoireService,
  normaliseFilename,
  uniquePgnFilename,
} from './RepertoireService';
export type { RepertoireStorage } from './storage/RepertoireStorage';
export { AsyncStorageRepertoireStorage, defaultRepertoireStorage } from './storage/AsyncStorageRepertoireStorage';
export type {
  RepertoireFolder,
  StoredPgnFile,
  PgnParseSummary,
  RepertoireStoreSnapshot,
  RepertoireSide,
} from './storage/types';
export { pgnFileDisplayName } from './storage/types';
export { joinSelectedPgnSlices } from './joinSelectedPgnSlices';
export { analyzeDeviation } from './RepertoireDeviationAnalyzer';
export type { DeviationAnalysis, TheoryContinuationStep } from './RepertoireDeviationAnalyzer';
export {
  mixedTrainingKey,
  pickMixedLine,
  sideToPlayerColor,
  filterFoldersByReviewSide,
  filterEntriesByReviewSide,
} from './MixedRepertoireTraining';
export type {
  MixedRepertoireEntry,
  MixedLinePick,
  ReviewSideFilter,
} from './MixedRepertoireTraining';
export { pickPgnFile } from './pickPgnFile';
export type { PickedPgnFile } from './pickPgnFile';
export { folderNameFromPgnFilename } from './folderNameFromPgnFilename';
export {
  getAllTrainingLinesFromPgn,
  getValidRepertoireSansAtFen,
} from './trainingLines';
export type {
  TrainingLinesResult,
  TrainingLinesError,
  GameTreeLine,
  GameTreeStats,
} from './trainingLines';

