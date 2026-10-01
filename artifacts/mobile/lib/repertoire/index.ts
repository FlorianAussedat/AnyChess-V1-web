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
export {
  isOpeningLineMastered,
  getOpeningPgnMastery,
  getOpeningPgnLearningCategory,
  sortLearningPgns,
  appendRevisionResult,
  lastFiveRevisionResults,
  openingLineKey,
  isPgnPriority,
  pgnMatchesLearningFilter,
  unmasteredLearningPaths,
  pickUnmasteredLearningPath,
  OPENING_MASTERY_WINDOW,
} from './openingMastery';
export type {
  OpeningRevisionResult,
  OpeningLearningCategory,
  OpeningLearningFilter,
  OpeningPgnMastery,
  LearningPgnSortItem,
} from './openingMastery';
export {
  OpeningMasteryStore,
  openingMasteryStore,
} from './OpeningMasteryStore';
export type {
  OpeningLineMasteryRecord,
  OpeningLineMasterySnapshot,
} from './OpeningMasteryStore';
export {
  describeOpeningPgnMastery,
  trainingPathsForPgn,
} from './openingMasteryViews';
export type {
  OpeningLineMasteryView,
  OpeningPgnMasteryView,
} from './openingMasteryViews';
export { joinSelectedPgnSlices, selectedPgnImports } from './joinSelectedPgnSlices';
export { combineFolderPgnTexts } from './combineFolderPgnTexts';
export {
  annotationsForPlayedLine,
  matchPlayedLine,
  exportOpeningPlayedPgn,
} from './playedLineAnnotations';
export type { PlyAnnotation } from './playedLineAnnotations';
export {
  isFolderEnabledForReview,
  isFileEnabledForReview,
  isFileVisibleInLearning,
  needsOppositeSideMoveConfirm,
} from './reviewActivation';
export {
  listReviewPoolEntries,
  countReviewLines,
  flattenReviewLines,
  pickReviewLine,
  pickReviewLineFromMemory,
  reviewPickToSession,
  applyReviewPick,
  resetReviewPickMemory,
} from './pickReviewLine';
export type { ReviewPoolEntry, ReviewLinePick } from './pickReviewLine';
export { hasAssignedRepertoireSide, requireRepertoireSide } from './folderSide';
export {
  setEphemeralOpeningSession,
  getEphemeralOpeningSession,
  leaveEphemeralOpeningExercise,
  clearEphemeralOpeningSession,
  isOpeningExercisePath,
  releaseEphemeralOpeningSessionIfLeaving,
  ephemeralSessionForOrigin,
} from './ephemeralOpeningSession';
export type { EphemeralOpeningSession } from './ephemeralOpeningSession';
export {
  recordOpeningRevisionResult,
  commitOpeningReviewAttempt,
  resetOpeningReviewRecordedFlag,
} from './recordOpeningRevision';
export {
  OpeningReviewAttempt,
  countUserMovesToFind,
  emptyReviewAttemptSnapshot,
  reviewResultFromAttempt,
} from './openingReviewAttempt';
export type { OpeningReviewAttemptSnapshot, ReviewSide } from './openingReviewAttempt';
export { reviewLineDisplayName, isGenericReviewLineName, sourceLabelFromPgnHeaders } from './reviewLineName';
export {
  commentOnReviewedLinePly,
  commentOnReviewedLineLastMove,
  resolvedCommentOnReviewedLinePly,
  resolvedFinalLineComment,
} from './reviewLineComment';
export { repertoireFromSans } from './repertoireFromSans';
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
export {
  isUnfiledOpeningFolder,
  UNFILED_OPENING_FOLDER_ID,
  makeUnfiledOpeningFolder,
} from './unfiledFolder';
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


