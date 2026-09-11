/**
 * « Quelle ouverture ? » — fixed session of 10 distinct lines for one level.
 * Scoring: correct = 1, wrong = 0; final score is X/10 (not a percent).
 */
import { Chess } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { validateOpeningAnswer, type OpeningAnswerVerdict } from './OpeningAnswerValidator.ts';
import type { OpeningQuizLine } from './OpeningQuizSelector.ts';
import {
  buildOpeningQuestionFromLine,
  pickDistinctLinesForDifficulty,
  promptKindForQuestion,
  type BuiltOpeningQuestion,
  type OpeningQuizAnswerMode,
  type OpeningQuizPromptKind,
} from './openingQuestionBuilder.ts';

export const OPENING_QUIZ_SESSION_SIZE = 10;

export type OpeningQuizReviewItem = {
  index: number;
  lineName: string;
  sans: string[];
  correct: boolean;
};

export type OpeningIdentificationRunSnapshot = {
  difficulty: AnyChessDifficultyId;
  /** True when fewer than OPENING_QUIZ_SESSION_SIZE unique lines were available. */
  insufficientLines: boolean;
  availableLineCount: number;
  questionIndex: number;
  totalQuestions: number;
  score: number;
  finished: boolean;
  line: OpeningQuizLine | null;
  fen: string;
  answered: boolean;
  verdict: OpeningAnswerVerdict | null;
  answerMode: OpeningQuizAnswerMode;
  promptKind: OpeningQuizPromptKind;
  step: 1 | 2;
  options: string[];
  review: OpeningQuizReviewItem[];
};

function emptySnapshot(
  difficulty: AnyChessDifficultyId,
  availableLineCount: number,
): OpeningIdentificationRunSnapshot {
  return {
    difficulty,
    insufficientLines: true,
    availableLineCount,
    questionIndex: 0,
    totalQuestions: 0,
    score: 0,
    finished: false,
    line: null,
    fen: new Chess().fen(),
    answered: false,
    verdict: null,
    answerMode: 'mcq',
    promptKind: 'family',
    step: 1,
    options: [],
    review: [],
  };
}

function fenAfterSans(sans: readonly string[]): string {
  const game = new Chess();
  for (const san of sans) {
    try {
      game.move(san);
    } catch {
      /* ignore illegal dataset rows */
    }
  }
  return game.fen();
}

export class OpeningIdentificationRun {
  private difficulty: AnyChessDifficultyId = 'debutant';
  private questions: BuiltOpeningQuestion[] = [];
  private review: OpeningQuizReviewItem[] = [];
  private questionIndex = 0;
  private score = 0;
  private step: 1 | 2 = 1;
  private answered = false;
  private verdict: OpeningAnswerVerdict | null = null;
  private finished = false;
  private insufficientLines = false;
  private availableLineCount = 0;

  getDifficulty(): AnyChessDifficultyId {
    return this.difficulty;
  }

  /**
   * Start a fresh run at `difficulty`. Requires exactly
   * `requiredCount` (default OPENING_QUIZ_SESSION_SIZE) distinct eligible
   * lines; otherwise returns an insufficient-lines snapshot (no crash,
   * no silent repeats).
   */
  start(
    difficulty: AnyChessDifficultyId,
    rng: () => number = Math.random,
    requiredCount: number = OPENING_QUIZ_SESSION_SIZE,
  ): OpeningIdentificationRunSnapshot {
    this.difficulty = difficulty;
    const need = Math.max(1, Math.floor(requiredCount));
    const lines = pickDistinctLinesForDifficulty(difficulty, need, rng);
    this.availableLineCount = lines.length;
    this.questions = [];
    this.review = [];
    this.questionIndex = 0;
    this.score = 0;
    this.step = 1;
    this.answered = false;
    this.verdict = null;
    this.finished = false;

    if (lines.length < need) {
      this.insufficientLines = true;
      return emptySnapshot(difficulty, lines.length);
    }

    this.insufficientLines = false;
    this.questions = lines.map((line) =>
      buildOpeningQuestionFromLine(line, difficulty, rng),
    );
    return this.snapshot();
  }

  /** Replay the same difficulty with a new random set of 10 lines. */
  replay(rng: () => number = Math.random): OpeningIdentificationRunSnapshot {
    return this.start(this.difficulty, rng);
  }

  answer(value: string): OpeningIdentificationRunSnapshot {
    if (this.insufficientLines || this.finished || this.answered) {
      return this.snapshot();
    }
    const question = this.questions[this.questionIndex];
    if (!question) return this.snapshot();

    const trimmed = value.trim();
    if (!trimmed) return this.snapshot();

    if (question.answerMode === 'free-text') {
      this.finishQuestion(validateOpeningAnswer(trimmed, question.correctName));
      return this.snapshot();
    }

    if (this.difficulty === 'debutant') {
      const ok = trimmed === question.correctFamily;
      this.finishQuestion({ correct: ok, acceptedAs: ok ? 'exact' : null });
      return this.snapshot();
    }

    if (this.difficulty === 'expert') {
      const ok = trimmed === question.correctName;
      this.finishQuestion({ correct: ok, acceptedAs: ok ? 'exact' : null });
      return this.snapshot();
    }

    // Confirmé — two steps
    if (this.step === 1) {
      if (trimmed !== question.correctFamily) {
        this.finishQuestion({ correct: false, acceptedAs: null });
        return this.snapshot();
      }
      this.step = 2;
      return this.snapshot();
    }

    const ok = trimmed === question.correctName;
    this.finishQuestion({ correct: ok, acceptedAs: ok ? 'exact' : null });
    return this.snapshot();
  }

  /**
   * After feedback: advance to the next question, or mark the run finished.
   */
  next(): OpeningIdentificationRunSnapshot {
    if (this.insufficientLines || this.finished || !this.answered) {
      return this.snapshot();
    }
    if (this.questionIndex >= this.questions.length - 1) {
      this.finished = true;
      return this.snapshot();
    }
    this.questionIndex += 1;
    this.step = 1;
    this.answered = false;
    this.verdict = null;
    return this.snapshot();
  }

  private finishQuestion(verdict: OpeningAnswerVerdict): void {
    const question = this.questions[this.questionIndex];
    if (!question) return;
    this.answered = true;
    this.verdict = verdict;
    if (verdict.correct) this.score += 1;
    this.review.push({
      index: this.questionIndex,
      lineName: question.correctName,
      sans: [...question.line.sans],
      correct: verdict.correct,
    });
  }

  snapshot(): OpeningIdentificationRunSnapshot {
    if (this.insufficientLines) {
      return emptySnapshot(this.difficulty, this.availableLineCount);
    }

    const question = this.questions[this.questionIndex] ?? null;
    const options =
      this.step === 2 && question?.step2Options
        ? question.step2Options
        : (question?.options ?? []);

    return {
      difficulty: this.difficulty,
      insufficientLines: false,
      availableLineCount: this.availableLineCount,
      questionIndex: this.questionIndex,
      totalQuestions: this.questions.length,
      score: this.score,
      finished: this.finished,
      line: question?.line ?? null,
      fen: fenAfterSans(question?.line.sans ?? []),
      answered: this.answered,
      verdict: this.verdict,
      answerMode: question?.answerMode ?? 'free-text',
      promptKind: promptKindForQuestion(this.difficulty, this.step),
      step: this.step,
      options,
      review: [...this.review],
    };
  }
}
