/**
 * Pure quiz engine for Culture générale chess-culture questions.
 * Storage I/O stays outside this module.
 */
import { Chess } from 'chess.js';
import type { BoardPiece } from '../game/types.ts';
import type {
  ChessCultureCategory,
  ChessCultureDifficulty,
  ChessCultureFeedbackSnapshot,
  ChessCultureFeedbackVote,
  ChessCultureQuestion,
  ChessCultureQuestionFeedback,
  ChessCultureQuizFilters,
  ChessCultureScore,
  ChessCultureSessionQuestion,
  ChessCultureSourceType,
} from './types.ts';

export const DEFAULT_CHESS_CULTURE_SESSION_SIZE = 10;
export const CHESS_CULTURE_BLACKLIST_DOWN_VOTES = 3;

const CATEGORIES: ReadonlySet<string> = new Set([
  'history',
  'players',
  'world-championship',
  'tournaments',
  'records',
  'rules',
  'terminology',
  'famous-games',
  'chess-culture',
  'checkmates',
  'openings',
  'tactics',
  'strategy',
  'modern-chess',
  'visual',
  'other',
]);

const SOURCE_TYPES: ReadonlySet<string> = new Set([
  'stable-fact',
  'historical-fact',
  'rule',
]);

export function isValidChessFen(fen: string): boolean {
  if (typeof fen !== 'string' || fen.trim().length === 0) return false;
  try {
    // chess.js throws on invalid FEN
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}

/** Convert a FEN string into the board matrix expected by ChessBoard. */
export function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

export function emptyChessCultureFeedbackSnapshot(): ChessCultureFeedbackSnapshot {
  return { version: 1, questions: {} };
}

export function getActiveChessCultureQuestions(
  questions: readonly ChessCultureQuestion[],
): ChessCultureQuestion[] {
  return questions.filter((q) => q.active === true);
}

function matchesFilters(
  question: ChessCultureQuestion,
  filters?: ChessCultureQuizFilters,
): boolean {
  if (!filters) return true;
  if (filters.categories && filters.categories.length > 0) {
    if (!filters.categories.includes(question.category)) return false;
  }
  if (filters.difficulties && filters.difficulties.length > 0) {
    if (!filters.difficulties.includes(question.difficulty)) return false;
  }
  if (filters.tags && filters.tags.length > 0) {
    const tagSet = new Set(question.tags);
    if (!filters.tags.some((t) => tagSet.has(t))) return false;
  }
  return true;
}

/**
 * Active source questions minus locally blacklisted ones.
 * Optionally applies future category/difficulty/tag filters (not exposed in UI yet).
 */
export function getEligibleChessCultureQuestions(
  questions: readonly ChessCultureQuestion[],
  feedback: ChessCultureFeedbackSnapshot,
  filters?: ChessCultureQuizFilters,
): ChessCultureQuestion[] {
  return getActiveChessCultureQuestions(questions).filter((q) => {
    const fb = feedback.questions[q.id];
    if (fb && fb.status === 'blacklisted' && fb.questionRevision === q.revision) {
      return false;
    }
    return matchesFilters(q, filters);
  });
}

function defaultRandom(): number {
  return Math.random();
}

function shuffleInPlace<T>(items: T[], random: () => number = defaultRandom): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}

/**
 * Build a session of up to `questionCount` questions without duplicates.
 * Does not mutate source question objects. Answer display order is shuffled.
 */
export function createChessCultureQuizSession(
  eligibleQuestions: readonly ChessCultureQuestion[],
  questionCount: number = DEFAULT_CHESS_CULTURE_SESSION_SIZE,
  random: () => number = defaultRandom,
): ChessCultureSessionQuestion[] {
  const count = Math.max(0, Math.floor(questionCount));
  if (count === 0 || eligibleQuestions.length === 0) return [];

  const pool = shuffleInPlace([...eligibleQuestions], random);
  const selected = pool.slice(0, Math.min(count, pool.length));

  return selected.map((question) => toSessionQuestion(question, random));
}

function toSessionQuestion(
  question: ChessCultureQuestion,
  random: () => number,
): ChessCultureSessionQuestion {
  const indices: [0, 1, 2, 3] = [0, 1, 2, 3];
  shuffleInPlace(indices, random);
  const displayAnswers = indices.map((i) => question.answers[i]) as [
    string,
    string,
    string,
    string,
  ];
  const correctDisplayIndex = indices.indexOf(question.correctAnswer) as 0 | 1 | 2 | 3;
  return {
    question,
    displayAnswers,
    correctDisplayIndex,
  };
}

export function calculateChessCultureScore(
  correctCount: number,
  total: number,
): ChessCultureScore {
  const correct = Math.max(0, Math.floor(correctCount));
  const safeTotal = Math.max(0, Math.floor(total));
  const percentage =
    safeTotal === 0 ? 0 : Math.round((correct / safeTotal) * 100);
  return { correct, total: safeTotal, percentage };
}

export function shouldBlacklistQuestion(downVotes: number): boolean {
  return downVotes >= CHESS_CULTURE_BLACKLIST_DOWN_VOTES;
}

/**
 * If stored feedback belongs to an older revision than the current question,
 * reset quality state so corrected questions can be tested again.
 */
export function reconcileFeedbackWithQuestionRevision(
  feedback: ChessCultureQuestionFeedback | undefined,
  question: Pick<ChessCultureQuestion, 'id' | 'revision'>,
): ChessCultureQuestionFeedback {
  if (!feedback || feedback.questionRevision < question.revision) {
    return {
      questionId: question.id,
      questionRevision: question.revision,
      upVotes: 0,
      downVotes: 0,
      status: 'normal',
    };
  }
  return { ...feedback };
}

/**
 * Apply a single quality vote for one presentation.
 * Callers must ensure only one final vote is persisted per presentation.
 * Does not mutate inputs.
 */
export function applyQuestionFeedback(
  snapshot: ChessCultureFeedbackSnapshot,
  question: Pick<ChessCultureQuestion, 'id' | 'revision'>,
  vote: ChessCultureFeedbackVote,
  nowIso: string = new Date().toISOString(),
): ChessCultureFeedbackSnapshot {
  const previous = reconcileFeedbackWithQuestionRevision(
    snapshot.questions[question.id],
    question,
  );

  // One feedback action per presentation: replace pending vote counts relative
  // to a clean base for this presentation. Callers pass the base snapshot from
  // before this presentation's vote when updating mid-screen (up→down).
  const next: ChessCultureQuestionFeedback = {
    questionId: question.id,
    questionRevision: question.revision,
    upVotes: previous.upVotes,
    downVotes: previous.downVotes,
    status: previous.status,
    lastFeedbackAt: nowIso,
  };

  if (vote === 'up') {
    next.upVotes = previous.upVotes + 1;
  } else {
    next.downVotes = previous.downVotes + 1;
  }

  if (shouldBlacklistQuestion(next.downVotes)) {
    next.status = 'blacklisted';
  } else if (next.upVotes >= 1) {
    next.status = 'validated';
  } else {
    next.status = 'normal';
  }

  return {
    version: 1,
    questions: {
      ...snapshot.questions,
      [question.id]: next,
    },
  };
}

/**
 * Replace a presentation vote: if the user switches thumbs during the same
 * screen, undo the previous vote on this presentation then apply the new one.
 */
export function replacePresentationFeedback(
  snapshotBeforePresentation: ChessCultureFeedbackSnapshot,
  question: Pick<ChessCultureQuestion, 'id' | 'revision'>,
  vote: ChessCultureFeedbackVote,
  nowIso: string = new Date().toISOString(),
): ChessCultureFeedbackSnapshot {
  return applyQuestionFeedback(snapshotBeforePresentation, question, vote, nowIso);
}

export type ChessCultureQuestionValidationError = {
  id: string | null;
  message: string;
};

export type ChessCultureQuestionValidationOptions = {
  /**
   * Registered semantic image IDs (from visualRegistry).
   * When provided, presentation.imageId must be in this set.
   */
  knownImageIds?: ReadonlySet<string>;
};

const IMAGE_FITS: ReadonlySet<string> = new Set(['cover', 'contain']);

export function validateChessCultureQuestion(
  question: unknown,
  index?: number,
  options?: ChessCultureQuestionValidationOptions,
): ChessCultureQuestionValidationError[] {
  const label = typeof index === 'number' ? `index ${index}` : 'question';
  const errors: ChessCultureQuestionValidationError[] = [];

  if (!question || typeof question !== 'object' || Array.isArray(question)) {
    errors.push({ id: null, message: `${label}: must be an object` });
    return errors;
  }

  const q = question as Partial<ChessCultureQuestion>;
  const id = typeof q.id === 'string' && q.id.length > 0 ? q.id : null;

  if (!id) errors.push({ id: null, message: `${label}: id is required` });
  if (typeof q.revision !== 'number' || !Number.isInteger(q.revision) || q.revision < 1) {
    errors.push({ id, message: `${id ?? label}: revision must be an integer >= 1` });
  }
  if (typeof q.question !== 'string' || q.question.trim().length === 0) {
    errors.push({ id, message: `${id ?? label}: question text must be non-empty` });
  }
  if (
    !Array.isArray(q.answers) ||
    q.answers.length !== 4 ||
    q.answers.some((a) => typeof a !== 'string' || a.trim().length === 0)
  ) {
    errors.push({ id, message: `${id ?? label}: answers must be exactly 4 non-empty strings` });
  }
  if (
    q.correctAnswer !== 0 &&
    q.correctAnswer !== 1 &&
    q.correctAnswer !== 2 &&
    q.correctAnswer !== 3
  ) {
    errors.push({ id, message: `${id ?? label}: correctAnswer must be 0|1|2|3` });
  }
  if (typeof q.explanation !== 'string' || q.explanation.trim().length === 0) {
    errors.push({ id, message: `${id ?? label}: explanation must be non-empty` });
  }
  if (typeof q.category !== 'string' || !CATEGORIES.has(q.category)) {
    errors.push({ id, message: `${id ?? label}: invalid category` });
  }
  if (
    q.difficulty !== 1 &&
    q.difficulty !== 2 &&
    q.difficulty !== 3 &&
    q.difficulty !== 4 &&
    q.difficulty !== 5
  ) {
    errors.push({ id, message: `${id ?? label}: difficulty must be 1..5` });
  }
  if (!Array.isArray(q.tags) || q.tags.some((t) => typeof t !== 'string')) {
    errors.push({ id, message: `${id ?? label}: tags must be an array of strings` });
  }
  if (typeof q.sourceType !== 'string' || !SOURCE_TYPES.has(q.sourceType)) {
    errors.push({ id, message: `${id ?? label}: invalid sourceType` });
  }
  if (typeof q.active !== 'boolean') {
    errors.push({ id, message: `${id ?? label}: active must be boolean` });
  }
  if (q.i18nEn !== undefined) {
    const en = q.i18nEn;
    if (!en || typeof en !== 'object' || Array.isArray(en)) {
      errors.push({ id, message: `${id ?? label}: i18nEn must be an object` });
    } else {
      if (typeof en.question !== 'string' || en.question.trim().length === 0) {
        errors.push({ id, message: `${id ?? label}: i18nEn.question must be non-empty` });
      }
      if (
        !Array.isArray(en.answers) ||
        en.answers.length !== 4 ||
        en.answers.some((a) => typeof a !== 'string' || a.trim().length === 0)
      ) {
        errors.push({
          id,
          message: `${id ?? label}: i18nEn.answers must be exactly 4 non-empty strings`,
        });
      }
      if (typeof en.explanation !== 'string' || en.explanation.trim().length === 0) {
        errors.push({
          id,
          message: `${id ?? label}: i18nEn.explanation must be non-empty`,
        });
      }
    }
  }
  if (q.presentation !== undefined) {
    if (
      !q.presentation ||
      typeof q.presentation !== 'object' ||
      Array.isArray(q.presentation)
    ) {
      errors.push({ id, message: `${id ?? label}: presentation must be an object` });
    } else {
      const presentation = q.presentation;
      if (presentation.boardFen !== undefined) {
        if (
          typeof presentation.boardFen !== 'string' ||
          !isValidChessFen(presentation.boardFen)
        ) {
          errors.push({ id, message: `${id ?? label}: presentation.boardFen is invalid` });
        }
      }
      if (presentation.imageId !== undefined) {
        if (typeof presentation.imageId !== 'string' || presentation.imageId.trim().length === 0) {
          errors.push({
            id,
            message: `${id ?? label}: presentation.imageId must be a non-empty string`,
          });
        } else if (
          options?.knownImageIds &&
          !options.knownImageIds.has(presentation.imageId)
        ) {
          errors.push({
            id,
            message: `Question ${id ?? label} references unknown imageId: ${presentation.imageId}`,
          });
        }
      }
      if (presentation.imageAlt !== undefined && typeof presentation.imageAlt !== 'string') {
        errors.push({ id, message: `${id ?? label}: presentation.imageAlt must be a string` });
      }
      if (
        presentation.imageCaption !== undefined &&
        typeof presentation.imageCaption !== 'string'
      ) {
        errors.push({
          id,
          message: `${id ?? label}: presentation.imageCaption must be a string`,
        });
      }
      if (presentation.imageFit !== undefined && !IMAGE_FITS.has(presentation.imageFit)) {
        errors.push({
          id,
          message: `${id ?? label}: presentation.imageFit must be 'cover' | 'contain'`,
        });
      }
      if (
        presentation.boardFlipped !== undefined &&
        typeof presentation.boardFlipped !== 'boolean'
      ) {
        errors.push({
          id,
          message: `${id ?? label}: presentation.boardFlipped must be boolean`,
        });
      }
      if (
        presentation.showCoordinates !== undefined &&
        typeof presentation.showCoordinates !== 'boolean'
      ) {
        errors.push({
          id,
          message: `${id ?? label}: presentation.showCoordinates must be boolean`,
        });
      }
    }
  }

  return errors;
}

export function validateChessCultureQuestionBank(
  questions: readonly unknown[],
  options?: ChessCultureQuestionValidationOptions,
): ChessCultureQuestionValidationError[] {
  const errors: ChessCultureQuestionValidationError[] = [];
  const seen = new Set<string>();

  questions.forEach((q, index) => {
    const local = validateChessCultureQuestion(q, index, options);
    errors.push(...local);
    if (q && typeof q === 'object' && !Array.isArray(q)) {
      const id = (q as { id?: unknown }).id;
      if (typeof id === 'string' && id.length > 0) {
        if (seen.has(id)) {
          errors.push({ id, message: `duplicate id: ${id}` });
        }
        seen.add(id);
      }
    }
  });

  return errors;
}

/** Type-narrow helpers for filters (future UI). */
export function isChessCultureCategory(value: string): value is ChessCultureCategory {
  return CATEGORIES.has(value);
}

export function isChessCultureDifficulty(value: number): value is ChessCultureDifficulty {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

export function isChessCultureSourceType(value: string): value is ChessCultureSourceType {
  return SOURCE_TYPES.has(value);
}
