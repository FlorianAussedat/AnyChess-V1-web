/**
 * Session controller for Suivi mental de position.
 */
import { analyzeHistory } from './PositionHistoryAnalyzer.ts';
import {
  generateQuestions,
  type PositionQuestion,
} from './PositionQuestionGenerator.ts';
import { validatePositionAnswer } from './PositionAnswerValidator.ts';

export const MENTAL_MAX_QUESTIONS = 10;
export const INSUFFICIENT_QUESTIONS_ERROR = 'Pas assez de questions fiables';

export type MentalPhase = 'setup' | 'showing' | 'questioning' | 'done' | 'error';

export type MentalAnswerLogEntry = {
  question: PositionQuestion;
  userAnswer: string;
  correct: boolean;
  expectedDisplay: string;
};

export type MentalSnapshot = {
  phase: MentalPhase;
  sans: string[];
  finalFen: string;
  orientation: 'w' | 'b';
  showBoardDuringSequence: boolean;
  dictateSequence: boolean;
  questionIndex: number;
  questions: PositionQuestion[];
  currentPrompt: string | null;
  lastFeedback: string | null;
  score: number;
  answered: number;
  answerLog: MentalAnswerLogEntry[];
  helpUsed: boolean;
  errorMessage: string | null;
};

export type HelpKind = 'redictate';

export class MentalPositionSession {
  private phase: MentalPhase = 'setup';
  private sans: string[] = [];
  private finalFen = '';
  private orientation: 'w' | 'b' = 'w';
  private showBoardDuringSequence = true;
  private dictateSequence = true;
  private questions: PositionQuestion[] = [];
  private questionIndex = 0;
  private score = 0;
  private answered = 0;
  private lastFeedback: string | null = null;
  private errorMessage: string | null = null;
  private answerLog: MentalAnswerLogEntry[] = [];
  private helpUsed = false;

  configure(options: {
    orientation: 'w' | 'b';
    showBoardDuringSequence: boolean;
    dictateSequence: boolean;
  }): void {
    this.orientation = options.orientation;
    this.showBoardDuringSequence = options.showBoardDuringSequence;
    this.dictateSequence = options.dictateSequence;
  }

  loadSequence(sans: string[], options: { maxQuestions?: number } = {}): MentalSnapshot {
    const maxQuestions = options.maxQuestions ?? MENTAL_MAX_QUESTIONS;
    try {
      const analysis = analyzeHistory(sans);
      this.sans = sans;
      this.finalFen = analysis.finalFen;
      this.questions = generateQuestions(analysis, { maxQuestions });
      this.questionIndex = 0;
      this.score = 0;
      this.answered = 0;
      this.lastFeedback = null;
      this.errorMessage = null;
      this.answerLog = [];
      this.helpUsed = false;
      this.phase = 'showing';
      if (this.questions.length < maxQuestions) {
        this.phase = 'error';
        this.errorMessage = INSUFFICIENT_QUESTIONS_ERROR;
      }
    } catch (err) {
      this.phase = 'error';
      this.errorMessage = err instanceof Error ? err.message : String(err);
    }
    return this.snapshot();
  }

  beginQuestions(): MentalSnapshot {
    if (this.phase !== 'showing' && this.phase !== 'questioning') return this.snapshot();
    this.phase = 'questioning';
    return this.snapshot();
  }

  recordHelp(_kind: HelpKind): void {
    this.helpUsed = true;
  }

  answer(raw: string): MentalSnapshot {
    if (this.phase !== 'questioning') return this.snapshot();
    const q = this.questions[this.questionIndex];
    if (!q) {
      this.phase = 'done';
      return this.snapshot();
    }
    const verdict = validatePositionAnswer(q, raw);
    if (verdict.recognitionFailure) {
      this.lastFeedback = 'Non reconnu — réessaie (non compté).';
      return this.snapshot();
    }
    this.answered += 1;
    const correct = verdict.correct;
    if (correct) {
      this.score += 1;
      this.lastFeedback = 'Correct.';
    } else {
      this.lastFeedback = `Incorrect. Réponse : ${q.displayAnswer}`;
    }
    this.answerLog.push({
      question: q,
      userAnswer: raw.trim(),
      correct,
      expectedDisplay: q.displayAnswer,
    });
    this.questionIndex += 1;
    if (this.questionIndex >= this.questions.length) {
      this.phase = 'done';
    }
    return this.snapshot();
  }

  snapshot(): MentalSnapshot {
    const q = this.questions[this.questionIndex] ?? null;
    return {
      phase: this.phase,
      sans: this.sans,
      finalFen: this.finalFen,
      orientation: this.orientation,
      showBoardDuringSequence: this.showBoardDuringSequence,
      dictateSequence: this.dictateSequence,
      questionIndex: this.questionIndex,
      questions: this.questions,
      currentPrompt: this.phase === 'questioning' ? q?.promptFr ?? null : null,
      lastFeedback: this.lastFeedback,
      score: this.score,
      answered: this.answered,
      answerLog: [...this.answerLog],
      helpUsed: this.helpUsed,
      errorMessage: this.errorMessage,
    };
  }
}
