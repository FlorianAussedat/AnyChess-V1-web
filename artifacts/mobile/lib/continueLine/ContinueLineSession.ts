/**
 * Session engine for Continue la ligne.
 *
 * One fixed PGN branch is followed strictly.
 * The user only recites THEIR side; opponent half-moves are auto-played
 * from the selected branch (no Stockfish, no free forks).
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { DEFAULT_FEN } from '../repertoire/repertoireTree.ts';
import type { ParsedRepertoire } from '../repertoire/types.ts';
import {
  fenAfterSans,
  pickStartPly,
  sampleRandomPath,
} from './RepertoireBranchSelector.ts';
import type {
  ContinueLineAttemptKind,
  ContinueLinePath,
  ContinueLinePhase,
  ContinueLineResult,
  ContinueLineSessionSnapshot,
} from './types.ts';

export type ContinueLineAttemptResult = {
  kind: ContinueLineAttemptKind;
  snapshot: ContinueLineSessionSnapshot;
  /** Opponent SANs auto-played after a correct user move (or at session start). */
  autoPlayedSans?: string[];
};

export class ContinueLineSession {
  private rep: ParsedRepertoire | null = null;
  private path: ContinueLinePath | null = null;
  private phase: ContinueLinePhase = 'loading';
  private repertoireName = '';
  private sourceLabel: string | null = null;
  private preambleSans: string[] = [];
  private startFen = DEFAULT_FEN;
  private startPly = 0;
  private board = new Chess();
  private correctCount = 0;
  private incorrectSan: string | null = null;
  private validAlternatives: string[] = [];
  private proposedContinuation: string[] = [];
  private lineCompleted = false;
  private errorMessage: string | null = null;
  private folderId: string | undefined;
  private trainingSide: 'white' | 'black' | undefined;
  /** Remaining SANs on the fixed branch (strict order). */
  private branchTail: string[] = [];

  loadError(message: string): void {
    this.phase = 'error';
    this.errorMessage = message;
  }

  private userColor(): 'w' | 'b' {
    return this.trainingSide === 'black' ? 'b' : 'w';
  }

  private isUserToMove(): boolean {
    return this.board.turn() === this.userColor();
  }

  /**
   * Play opponent moves from the fixed branch until it is the user's turn
   * or the branch is exhausted. Does not increment correctCount.
   */
  private autoPlayOpponentFromBranch(): string[] {
    const played: string[] = [];
    while (
      this.phase === 'reciting' &&
      !this.isUserToMove() &&
      this.branchTail.length > 0
    ) {
      const san = this.branchTail[0]!;
      const move = this.board.move(san);
      if (!move) break;
      this.branchTail = this.branchTail.slice(1);
      played.push(move.san);
    }
    if (this.branchTail.length === 0) {
      this.phase = 'completed';
      this.lineCompleted = true;
    }
    return played;
  }

  start(
    rep: ParsedRepertoire,
    repertoireName: string,
    options: {
      recentPathIds?: string[];
      rng?: () => number;
      sourceLabel?: string | null;
      path?: ContinueLinePath | null;
      startPly?: number;
      folderId?: string;
      trainingSide?: 'white' | 'black';
    } = {},
  ): ContinueLineSessionSnapshot {
    this.rep = rep;
    this.repertoireName = repertoireName;
    this.sourceLabel = options.sourceLabel ?? null;
    this.folderId = options.folderId;
    this.trainingSide = options.trainingSide;
    this.incorrectSan = null;
    this.validAlternatives = [];
    this.proposedContinuation = [];
    this.lineCompleted = false;
    this.correctCount = 0;
    this.errorMessage = null;

    const path =
      options.path ??
      sampleRandomPath(rep, {
        recentPathIds: options.recentPathIds,
        rng: options.rng,
      });

    if (!path || path.sans.length === 0) {
      this.phase = 'error';
      this.errorMessage = 'Aucune ligne jouable dans ce répertoire.';
      this.path = null;
      return this.snapshot();
    }

    this.path = path;
    const startPly =
      options.startPly ??
      pickStartPly(path.sans.length, { rng: options.rng, minTail: 3 });
    this.startPly = startPly;
    this.preambleSans = path.sans.slice(0, startPly);
    this.branchTail = path.sans.slice(startPly);
    this.startFen = fenAfterSans(DEFAULT_FEN, this.preambleSans);
    this.board = new Chess(this.startFen);
    this.phase = 'ready';
    return this.snapshot();
  }

  beginRecitation(): ContinueLineAttemptResult {
    if (this.phase !== 'ready' && this.phase !== 'reciting') {
      return { kind: 'correct', snapshot: this.snapshot(), autoPlayedSans: [] };
    }
    this.phase = 'reciting';
    if (this.branchTail.length === 0) {
      this.phase = 'completed';
      this.lineCompleted = true;
      return { kind: 'correct', snapshot: this.snapshot(), autoPlayedSans: [] };
    }
    const autoPlayedSans = this.autoPlayOpponentFromBranch();
    return { kind: 'correct', snapshot: this.snapshot(), autoPlayedSans };
  }

  applyChessMove(move: Move): ContinueLineAttemptResult {
    if (this.phase !== 'reciting' || !this.rep) {
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    if (!this.isUserToMove()) {
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    const expected = this.branchTail[0] ?? null;
    if (!expected || move.san !== expected) {
      this.phase = 'failed';
      this.incorrectSan = move.san;
      this.validAlternatives = expected ? [expected] : [];
      this.proposedContinuation = [...this.branchTail];
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    const played = this.board.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || 'q',
    });
    if (!played || played.san !== expected) {
      // Undo partial if SAN mismatched after apply
      if (played) this.board.undo();
      this.phase = 'failed';
      this.incorrectSan = move.san;
      this.validAlternatives = [expected];
      this.proposedContinuation = [...this.branchTail];
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    this.branchTail = this.branchTail.slice(1);
    this.correctCount += 1;

    if (this.branchTail.length === 0) {
      this.phase = 'completed';
      this.lineCompleted = true;
      return { kind: 'correct', snapshot: this.snapshot(), autoPlayedSans: [] };
    }

    const autoPlayedSans = this.autoPlayOpponentFromBranch();
    return { kind: 'correct', snapshot: this.snapshot(), autoPlayedSans };
  }

  recordRecognitionFailure(): ContinueLineSessionSnapshot {
    return this.snapshot();
  }

  getResult(): ContinueLineResult | null {
    if (this.phase !== 'completed' && this.phase !== 'failed') return null;
    return {
      repertoireName: this.repertoireName,
      sourceLabel: this.sourceLabel,
      correctHalfMoves: this.correctCount,
      incorrectSan: this.incorrectSan,
      validAlternatives: this.validAlternatives,
      proposedContinuation: this.proposedContinuation,
      lineCompleted: this.lineCompleted,
      preambleSans: this.preambleSans,
    };
  }

  snapshot(): ContinueLineSessionSnapshot {
    const fen = this.board.fen();
    const expected = this.phase === 'reciting' ? (this.branchTail[0] ?? null) : null;
    return {
      phase: this.phase,
      repertoireName: this.repertoireName,
      sourceLabel: this.sourceLabel,
      preambleSans: this.preambleSans,
      startFen: this.startFen,
      startPly: this.startPly,
      currentFen: fen,
      correctCount: this.correctCount,
      recitedSans: this.board.history(),
      availableSans: expected ? [expected] : [],
      incorrectSan: this.incorrectSan,
      validAlternatives: this.validAlternatives,
      proposedContinuation: this.proposedContinuation,
      lineCompleted: this.lineCompleted,
      errorMessage: this.errorMessage,
      folderId: this.folderId,
      trainingSide: this.trainingSide,
    };
  }

  getPathId(): string | null {
    return this.path?.id ?? null;
  }

  getPath(): ContinueLinePath | null {
    return this.path;
  }

  getStartPly(): number {
    return this.startPly;
  }
}
