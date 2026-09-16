import { Chess } from 'chess.js';
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';
import { validateOpeningAnswer, type OpeningAnswerVerdict } from './OpeningAnswerValidator.ts';
import type { OpeningQuizLine } from './OpeningQuizSelector.ts';
import {
  buildOpeningQuestion,
  promptKindForQuestion,
  type BuiltOpeningQuestion,
  type OpeningQuizAnswerMode,
  type OpeningQuizPromptKind,
} from './openingQuestionBuilder.ts';

export type OpeningIdentificationSnapshot = {
  line: OpeningQuizLine | null;
  fen: string;
  answered: boolean;
  verdict: OpeningAnswerVerdict | null;
  difficulty: AnyChessDifficultyId;
  answerMode: OpeningQuizAnswerMode;
  promptKind: OpeningQuizPromptKind;
  /** Confirmé: 1 = family, 2 = variation. */
  step: 1 | 2;
  options: string[];
};

export class OpeningIdentificationSession {
  private difficulty: AnyChessDifficultyId = 'debutant';
  private question: BuiltOpeningQuestion | null = null;
  private step: 1 | 2 = 1;
  private answered = false;
  private verdict: OpeningAnswerVerdict | null = null;

  getDifficulty(): AnyChessDifficultyId {
    return this.difficulty;
  }

  setDifficulty(difficulty: AnyChessDifficultyId): void {
    this.difficulty = difficulty;
  }

  start(
    recentNames: string[] = [],
    rng: () => number = Math.random,
  ): OpeningIdentificationSnapshot {
    this.question = buildOpeningQuestion(this.difficulty, recentNames, rng);
    this.step = 1;
    this.answered = false;
    this.verdict = null;
    return this.snapshot();
  }

  /**
   * Restart with a new difficulty (clears current round).
   */
  startWithDifficulty(
    difficulty: AnyChessDifficultyId,
    recentNames: string[] = [],
    rng: () => number = Math.random,
  ): OpeningIdentificationSnapshot {
    this.difficulty = difficulty;
    return this.start(recentNames, rng);
  }

  answer(value: string): OpeningIdentificationSnapshot {
    if (!this.question || this.answered) return this.snapshot();
    const trimmed = value.trim();
    if (!trimmed) return this.snapshot();

    if (this.question.answerMode === 'free-text') {
      this.answered = true;
      this.verdict = validateOpeningAnswer(trimmed, this.question.correctName);
      return this.snapshot();
    }

    if (this.difficulty === 'debutant') {
      this.answered = true;
      const ok = trimmed === this.question.correctFamily;
      this.verdict = { correct: ok, acceptedAs: ok ? 'exact' : null };
      return this.snapshot();
    }

    if (this.difficulty === 'expert') {
      this.answered = true;
      const ok = trimmed === this.question.correctName;
      this.verdict = { correct: ok, acceptedAs: ok ? 'exact' : null };
      return this.snapshot();
    }

    // Confirmé — two steps
    if (this.step === 1) {
      if (trimmed !== this.question.correctFamily) {
        this.answered = true;
        this.verdict = { correct: false, acceptedAs: null };
        return this.snapshot();
      }
      this.step = 2;
      return this.snapshot();
    }

    this.answered = true;
    const ok = trimmed === this.question.correctName;
    this.verdict = { correct: ok, acceptedAs: ok ? 'exact' : null };
    return this.snapshot();
  }

  snapshot(): OpeningIdentificationSnapshot {
    const game = new Chess();
    for (const san of this.question?.line.sans ?? []) {
      try {
        game.move(san);
      } catch {
        /* ignore illegal dataset rows */
      }
    }

    const options =
      this.step === 2 && this.question?.step2Options
        ? this.question.step2Options
        : (this.question?.options ?? []);

    return {
      line: this.question?.line ?? null,
      fen: game.fen(),
      answered: this.answered,
      verdict: this.verdict,
      difficulty: this.difficulty,
      answerMode: this.question?.answerMode ?? 'free-text',
      promptKind: promptKindForQuestion(this.difficulty, this.step),
      step: this.step,
      options,
    };
  }
}
