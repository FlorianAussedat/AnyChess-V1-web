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
  lastAttemptedSan: string | null;
  feedback: string | null;
  fen: string;
};

/** Player-facing snapshot — never exposes expectedSan during play. */
export type PlayerConstructionSnapshot = Omit<ConstructionSnapshot, 'expectedSan'> & {
  expectedSan?: string | null;
};

export class OpeningConstructionSession {
  private readonly target: OpeningTarget;
  private readonly game = new Chess();
  private playedSans: string[] = [];
  private phase: ConstructionPhase = 'playing';
  private feedback: string | null = null;
  private lastAttemptedSan: string | null = null;

  constructor(target: OpeningTarget) {
    this.target = target;
  }

  answer(raw: string): ConstructionSnapshot {
    if (this.phase !== 'playing') return this.snapshot();

    const parsed = parseChessVoice(raw, this.game);
    if (parsed.type !== 'move') {
      this.feedback =
        parsed.type === 'ambiguous'
          ? 'Ambigu — reformule le coup (non compté comme erreur).'
          : 'Coup non reconnu.';
      return this.snapshot();
    }

    const verdict = matchOpeningMove(this.target, this.playedSans.length, parsed.move.san);
    if (!verdict.correct) {
      this.phase = 'wrong';
      this.lastAttemptedSan = parsed.move.san;
      const expected = verdict.expectedSan ?? '?';
      this.feedback = `Incorrect : ${parsed.move.san}. Attendu : ${expected}. Ligne complète : ${this.target.sans.join(' ')}`;
      return this.snapshot();
    }

    this.lastAttemptedSan = null;
    this.game.move(parsed.move.san);
    this.playedSans.push(parsed.move.san);
    if (verdict.complete) {
      this.phase = 'complete';
      this.feedback = 'Ouverture construite !';
    } else {
      this.feedback = null;
    }
    return this.snapshot();
  }

  snapshot(): ConstructionSnapshot {
    return {
      phase: this.phase,
      target: this.target,
      playedSans: [...this.playedSans],
      expectedSan: this.target.sans[this.playedSans.length] ?? null,
      lastAttemptedSan: this.lastAttemptedSan,
      feedback: this.feedback,
      fen: this.game.fen(),
    };
  }

  snapshotForPlayer(): PlayerConstructionSnapshot {
    const full = this.snapshot();
    if (full.phase === 'playing') {
      const { expectedSan: _hidden, ...rest } = full;
      return rest;
    }
    return full;
  }

  getBoard(): ReturnType<Chess['board']> {
    return this.game.board();
  }
}
