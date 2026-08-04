/**
 * Shared schema for the Culture générale chess-culture quiz.
 * All source questions must follow this exact shape.
 */

export type ChessCultureCategory =
  | 'history'
  | 'players'
  | 'world-championship'
  | 'tournaments'
  | 'records'
  | 'rules'
  | 'terminology'
  | 'famous-games'
  | 'chess-culture'
  | 'other';

export type ChessCultureSourceType =
  | 'stable-fact'
  | 'historical-fact'
  | 'rule';

export type ChessCultureDifficulty = 1 | 2 | 3 | 4 | 5;

export type ChessCulturePresentation = {
  boardFen?: string;
  boardFlipped?: boolean;
  showCoordinates?: boolean;
};

export type ChessCultureQuestion = {
  id: string;
  revision: number;
  question: string;
  answers: [string, string, string, string];
  correctAnswer: 0 | 1 | 2 | 3;
  explanation: string;
  category: ChessCultureCategory;
  subcategory?: string;
  difficulty: ChessCultureDifficulty;
  tags: string[];
  sourceType: ChessCultureSourceType;
  active: boolean;
  presentation?: ChessCulturePresentation;
};

export type ChessCultureFeedbackStatus = 'normal' | 'validated' | 'blacklisted';

export type ChessCultureQuestionFeedback = {
  questionId: string;
  questionRevision: number;
  upVotes: number;
  downVotes: number;
  status: ChessCultureFeedbackStatus;
  lastFeedbackAt?: string;
};

export type ChessCultureFeedbackSnapshot = {
  version: 1;
  questions: Record<string, ChessCultureQuestionFeedback>;
};

export type ChessCultureFeedbackVote = 'up' | 'down';

export type ChessCultureQuizFilters = {
  categories?: ChessCultureCategory[];
  difficulties?: ChessCultureDifficulty[];
  tags?: string[];
};

/** Session question with optional answer display order (source never mutated). */
export type ChessCultureSessionQuestion = {
  question: ChessCultureQuestion;
  /** Answers as shown to the player (may be shuffled). */
  displayAnswers: [string, string, string, string];
  /** Index of the correct answer within displayAnswers. */
  correctDisplayIndex: 0 | 1 | 2 | 3;
};

export type ChessCultureScore = {
  correct: number;
  total: number;
  percentage: number;
};
