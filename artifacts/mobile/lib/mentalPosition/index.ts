export {
  analyzeHistory,
  countDeveloped,
  pieceOnSquare,
  pieceById,
  squareAtHalfMove,
  pieceAtFen,
  countPiecesOnBoard,
} from './PositionHistoryAnalyzer.ts';
export type {
  TrackedPiece,
  HistoryAnalysis,
  CaptureRecord,
  CastlingPlayed,
  CastlingRightsRemaining,
} from './PositionHistoryAnalyzer.ts';
export {
  generateQuestions,
  buildQuestionPool,
  normalizeAnswer,
} from './PositionQuestionGenerator.ts';
export type {
  PositionQuestion,
  QuestionKind,
  QuestionCategory,
} from './PositionQuestionGenerator.ts';
export { validatePositionAnswer } from './PositionAnswerValidator.ts';
export {
  MentalPositionSession,
  MENTAL_MAX_QUESTIONS,
  INSUFFICIENT_QUESTIONS_ERROR,
} from './MentalPositionSession.ts';
export type {
  MentalSnapshot,
  MentalPhase,
  MentalAnswerLogEntry,
  HelpKind,
} from './MentalPositionSession.ts';
export {
  generateMentalSequence,
  generateMentalSequenceWithQuestions,
} from './generateMentalSequence.ts';
export {
  MENTAL_FULL_MOVES_MIN,
  MENTAL_FULL_MOVES_MAX,
  clampMentalFullMoves,
  mentalHalfMoveCount,
  mentalFullMoveStops,
  toggleMentalPresentation,
} from './mentalPresentation.ts';
export type { MentalPresentationFlags } from './mentalPresentation.ts';
