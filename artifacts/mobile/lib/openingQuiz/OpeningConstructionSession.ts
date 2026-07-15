import { Chess } from 'chess.js';
import { parseChessVoice } from '../voice/parseChessVoice.ts';
import type { OpeningTarget } from './OpeningLineBuilder.ts';
import { matchOpeningMove } from './OpeningTargetMatcher.ts';

export type ConstructionPhase = 'playing' | 'wrong' | 'complete';
export type ConstructionSnapshot = {
  phase: ConstructionPhase;
  target: OpeningTarget;
  playedSans: string[];
  expectedSan: string | null;
  feedback: string | null;
};

export class OpeningConstructionSession {
  private readonly target: OpeningTarget;
  private readonly game = new Chess();
  private playedSans: string[] = [];
  private phase: ConstructionPhase = 'playing';
  private feedback: string | null = null;

  constructor(target: OpeningTarget) {
    this.target = target;
  }

  answer(raw: string): ConstructionSnapshot {
    if (this.phase !== 'playing') return this.snapshot();
    const parsed = parseChessVoice(raw, this.game);
    if (parsed.type !== 'move') {
      this.feedback = 'Coup non reconnu.';
      return this.snapshot();
    }
    const verdict = matchOpeningMove(this.target, this.playedSans.length, parsed.move.san);
    if (!verdict.correct) {
      this.phase = 'wrong';
      this.feedback = `Incorrect. La suite attendue : ${this.target.sans.join(' ')}`;
      return this.snapshot();
    }
    this.game.move(parsed.move.san);
    this.playedSans.push(parsed.move.san);
    if (verdict.complete) {
      this.phase = 'complete';
      this.feedback = 'Ouverture construite !';
    }
    return this.snapshot();
  }

  snapshot(): ConstructionSnapshot {
    return {
      phase: this.phase,
      target: this.target,
      playedSans: [...this.playedSans],
      expectedSan: this.target.sans[this.playedSans.length] ?? null,
      feedback: this.feedback,
    };
  }
}
