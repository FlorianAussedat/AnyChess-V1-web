/**
 * Session engine for Continue la ligne.
 * Accepts any repertoire move at the current node; forks follow the chosen branch.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { DEFAULT_FEN, movesForPosition } from '../repertoire/repertoireTree.ts';
import type { ParsedRepertoire } from '../repertoire/types.ts';
import {
  fenAfterSans,
  isBookUci,
  pickStartPly,
  proposedContinuationSans,
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
  /** Remaining preferred SANs from the original sample (advisory). */
  private preferTail: string[] = [];

  loadError(message: string): void {
    this.phase = 'error';
    this.errorMessage = message;
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
    this.preferTail = path.sans.slice(startPly);
    this.startFen = fenAfterSans(DEFAULT_FEN, this.preambleSans);
    this.board = new Chess(this.startFen);
    this.phase = 'ready';
    return this.snapshot();
  }

  beginRecitation(): ContinueLineSessionSnapshot {
    if (this.phase !== 'ready' && this.phase !== 'reciting') return this.snapshot();
    this.phase = 'reciting';
    if (this.rep && movesForPosition(this.rep, this.board.fen()).length === 0) {
      this.phase = 'completed';
      this.lineCompleted = true;
    }
    return this.snapshot();
  }

  applyChessMove(move: Move): ContinueLineAttemptResult {
    if (this.phase !== 'reciting' || !this.rep) {
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    const fen = this.board.fen();
    const bookMoves = movesForPosition(this.rep, fen);

    if (!isBookUci(this.rep, fen, move.from, move.to, move.promotion ?? null)) {
      this.phase = 'failed';
      this.incorrectSan = move.san;
      this.validAlternatives = bookMoves.map((m) => m.san);
      this.proposedContinuation = proposedContinuationSans(
        this.rep,
        fen,
        12,
        this.preferTail,
      );
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    const played = this.board.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion || 'q',
    });
    if (!played) {
      return { kind: 'wrong', snapshot: this.snapshot() };
    }

    this.correctCount += 1;
    if (this.preferTail[0] === played.san) {
      this.preferTail = this.preferTail.slice(1);
    } else {
      this.preferTail = proposedContinuationSans(this.rep, this.board.fen(), 40);
    }

    if (movesForPosition(this.rep, this.board.fen()).length === 0) {
      this.phase = 'completed';
      this.lineCompleted = true;
    }

    return { kind: 'correct', snapshot: this.snapshot() };
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
    const available =
      this.rep && (this.phase === 'reciting' || this.phase === 'ready')
        ? movesForPosition(this.rep, fen).map((m) => m.san)
        : [];
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
      availableSans: available,
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
