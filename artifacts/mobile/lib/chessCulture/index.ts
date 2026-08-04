/**
 * Culture générale — chess culture quiz module.
 *
 * Canonical question database: ./questions.ts
 */
export type {
  ChessCultureCategory,
  ChessCultureSourceType,
  ChessCultureDifficulty,
  ChessCulturePresentation,
  ChessCultureQuestion,
  ChessCultureFeedbackStatus,
  ChessCultureQuestionFeedback,
  ChessCultureFeedbackSnapshot,
  ChessCultureFeedbackVote,
  ChessCultureQuizFilters,
  ChessCultureSessionQuestion,
  ChessCultureScore,
} from './types.ts';

export { CHESS_CULTURE_QUESTIONS } from './questions.ts';

export {
  DEFAULT_CHESS_CULTURE_SESSION_SIZE,
  CHESS_CULTURE_BLACKLIST_DOWN_VOTES,
  isValidChessFen,
  boardFromFen,
  emptyChessCultureFeedbackSnapshot,
  getActiveChessCultureQuestions,
  getEligibleChessCultureQuestions,
  createChessCultureQuizSession,
  calculateChessCultureScore,
  shouldBlacklistQuestion,
  reconcileFeedbackWithQuestionRevision,
  applyQuestionFeedback,
  replacePresentationFeedback,
  validateChessCultureQuestion,
  validateChessCultureQuestionBank,
  isChessCultureCategory,
  isChessCultureDifficulty,
  isChessCultureSourceType,
} from './quizEngine.ts';

export type { ChessCultureQuestionValidationError } from './quizEngine.ts';

export {
  QuestionFeedbackStore,
  questionFeedbackStore,
  CHESS_CULTURE_FEEDBACK_STORAGE_KEY,
  validateChessCultureFeedbackSnapshot,
  reconcileFeedbackSnapshotWithQuestions,
  getBlacklistedChessCultureQuestionIds,
  getChessCultureFeedbackSnapshot,
} from './QuestionFeedbackStore.ts';
