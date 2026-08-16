/**
 * Culture générale — chess culture quiz module.
 *
 * Canonical question database: ./questions.ts
 * Visual registry: ./visualRegistry.ts
 */
export type {
  ChessCultureCategory,
  ChessCultureSourceType,
  ChessCultureDifficulty,
  ChessCultureImageFit,
  ChessCulturePresentation,
  ChessCultureQuestion,
  ChessCultureQuestionI18nEn,
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
  localizeChessCultureQuestion,
  localizeChessCultureQuestions,
} from './localizeQuestion.ts';

export type { AppQuizLanguage } from './localizeQuestion.ts';

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

export type {
  ChessCultureQuestionValidationError,
  ChessCultureQuestionValidationOptions,
} from './quizEngine.ts';

export {
  CHESS_CULTURE_IMAGE_REGISTRY,
  listChessCultureImageIds,
  hasChessCultureImage,
  getChessCultureImage,
  resolveChessCultureImageSource,
} from './visualRegistry.ts';

export type { ChessCultureRegisteredImageId } from './visualRegistry.ts';

export {
  QuestionFeedbackStore,
  questionFeedbackStore,
  CHESS_CULTURE_FEEDBACK_STORAGE_KEY,
  validateChessCultureFeedbackSnapshot,
  reconcileFeedbackSnapshotWithQuestions,
  getBlacklistedChessCultureQuestionIds,
  getChessCultureFeedbackSnapshot,
} from './QuestionFeedbackStore.ts';
