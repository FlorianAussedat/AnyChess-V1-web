/**
 * Session controller for Suivi mental de position.
 */
import { analyzeHistory } from './PositionHistoryAnalyzer.ts';
import {
  generateQuestions,
  type PositionQuestion,
} from './PositionQuestionGenerator.ts';
import { validatePositionAnswer } from './PositionAnswerValidator.ts';

export type MentalPhase = 'setup' | 'showing' | 'questioning' | 'done' | 'error';

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
  errorMessage: string | null;
};

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

  configure(options: {
    orientation: 'w' | 'b';
    showBoardDuringSequence: boolean;
    dictateSequence: boolean;
  }): void {
    this.orientation = options.orientation;
    this.showBoardDuringSequence = options.showBoardDuringSequence;
    this.dictateSequence = options.dictateSequence;
  }

  loadSequence(sans: string[]): MentalSnapshot {
    try {
      const analysis = analyzeHistory(sans);
      this.sans = sans;
      this.finalFen = analysis.finalFen;
      this.questions = generateQuestions(analysis, { maxQuestions: 5 });
      this.questionIndex = 0;
      this.score = 0;
      this.answered = 0;
      this.lastFeedback = null;
      this.errorMessage = null;
      this.phase = 'showing';
      if (this.questions.length === 0) {
        this.phase = 'error';
        this.errorMessage = 'Aucune question fiable pour cette séquence.';
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
    if (verdict.correct) {
      this.score += 1;
      this.lastFeedback = 'Correct.';
    } else {
      this.lastFeedback = `Incorrect. Réponse : ${q.displayAnswer}`;
    }
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
      errorMessage: this.errorMessage,
    };
  }
}
