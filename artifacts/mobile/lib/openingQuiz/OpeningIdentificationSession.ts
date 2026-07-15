import { Chess } from 'chess.js';
import { pickOpeningQuizLine, type OpeningQuizLine } from './OpeningQuizSelector.ts';
import { validateOpeningAnswer, type OpeningAnswerVerdict } from './OpeningAnswerValidator.ts';

export type OpeningIdentificationSnapshot = {
  line: OpeningQuizLine | null;
  fen: string;
  answered: boolean;
  verdict: OpeningAnswerVerdict | null;
};

export class OpeningIdentificationSession {
  private line: OpeningQuizLine | null = null;
  private answered = false;
  private verdict: OpeningAnswerVerdict | null = null;

  start(recentNames: string[] = [], rng: () => number = Math.random): OpeningIdentificationSnapshot {
    this.line = pickOpeningQuizLine(recentNames, rng);
    this.answered = false;
    this.verdict = null;
    return this.snapshot();
  }

  answer(value: string): OpeningIdentificationSnapshot {
    if (!this.line || this.answered) return this.snapshot();
    this.answered = true;
    this.verdict = validateOpeningAnswer(value, this.line.identity.name);
    return this.snapshot();
  }

  snapshot(): OpeningIdentificationSnapshot {
    const game = new Chess();
    for (const san of this.line?.sans ?? []) game.move(san);
    return { line: this.line, fen: game.fen(), answered: this.answered, verdict: this.verdict };
  }
}
