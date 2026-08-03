import { Chess, type Square } from 'chess.js';
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

    return this.attemptResolvedSan(parsed.move.san);
  }

  /** Validate a spoken/typed SAN against the exact reference line matcher. */
  attemptSan(san: string): ConstructionSnapshot {
    if (this.phase !== 'playing') return this.snapshot();

    let moveSan: string;
    try {
      const probe = new Chess(this.game.fen());
      const played = probe.move(san);
      if (!played) {
        this.feedback = 'Coup non reconnu.';
        return this.snapshot();
      }
      moveSan = played.san;
    } catch {
      this.feedback = 'Coup non reconnu.';
      return this.snapshot();
    }

    return this.attemptResolvedSan(moveSan);
  }

  /** Touch/mouse: convert from/to via chess.js, then same matcher as text/voice. */
  attemptMove(coords: { from: string; to: string; promotion?: string }): ConstructionSnapshot {
    if (this.phase !== 'playing') return this.snapshot();

    let moveSan: string;
    try {
      const probe = new Chess(this.game.fen());
      const played = probe.move({
        from: coords.from,
        to: coords.to,
        promotion: coords.promotion ?? 'q',
      });
      if (!played) {
        this.feedback = 'Coup non reconnu.';
        return this.snapshot();
      }
      moveSan = played.san;
    } catch {
      this.feedback = 'Coup non reconnu.';
      return this.snapshot();
    }

    return this.attemptResolvedSan(moveSan);
  }

  getLegalDestinations(square: string): string[] {
    if (this.phase !== 'playing') return [];
    const piece = this.game.get(square as Square);
    if (!piece || piece.color !== this.game.turn()) return [];
    try {
      const moves = this.game.moves({ verbose: true, square: square as Square });
      return [...new Set(moves.map((m) => m.to))];
    } catch {
      return [];
    }
  }

  private attemptResolvedSan(san: string): ConstructionSnapshot {
    const verdict = matchOpeningMove(this.target, this.playedSans.length, san);
    if (!verdict.correct) {
      this.phase = 'wrong';
      this.lastAttemptedSan = san;
      const expected = verdict.expectedSan ?? '?';
      this.feedback = `Incorrect : ${san}. Attendu : ${expected}. Ligne complète : ${this.target.sans.join(' ')}`;
      return this.snapshot();
    }

    this.lastAttemptedSan = null;
    this.game.move(san);
    this.playedSans.push(san);
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
