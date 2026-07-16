/**
 * Core puzzle solving engine (no React).
 *
 * Lichess convention:
 *   source FEN → apply moves[0] (setup, never scored) → user finds moves[1],
 *   app plays moves[2], user finds moves[3], …
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { sanToVerbal, verbalMove } from '../chessParser.ts';
import { isExpectedMove, normalizeUci, uciFromSquares } from './PuzzleMoveValidator.ts';
import {
  emptyPuzzleStats,
  finalizePuzzleStats,
  type LocalPuzzle,
  type PuzzleAttemptResult,
  type PuzzleAttemptStats,
  type PuzzleOrientation,
  type PuzzleReplayMove,
} from './types.ts';

export interface PuzzleSessionSnapshot {
  puzzle: LocalPuzzle;
  setupUci: string;
  startFen: string;
  fen: string;
  sideToMove: 'w' | 'b';
  orientation: PuzzleOrientation;
  solutionIndex: number;
  done: boolean;
  stats: PuzzleAttemptStats;
}

export interface PuzzleAttemptOutcome {
  result: PuzzleAttemptResult;
  /** User move that was accepted (correct / complete). */
  userMove?: Move;
  /** Auto-played opponent reply, if any. */
  opponentMove?: Move;
}

function countUserPlies(moves: string[]): number {
  // Indices 1, 3, 5, … are user moves after setup.
  let n = 0;
  for (let i = 1; i < moves.length; i += 2) n += 1;
  return n;
}

function applyUci(game: Chess, uci: string): Move {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.slice(4) || undefined;
  return game.move({ from, to, promotion }) as Move;
}

function tryApplyUci(game: Chess, uci: string): Move | null {
  try {
    return applyUci(game, uci);
  } catch {
    return null;
  }
}

/** Numbered SAN line; `startsWithBlack` → first ply shown as `1... move`. */
function formatNumberedSanLine(sans: string[], startsWithBlack = false): string {
  if (sans.length === 0) return '';
  const parts: string[] = [];
  let i = 0;
  let moveNum = 1;

  if (startsWithBlack) {
    parts.push(`1... ${sans[0]}`);
    i = 1;
    moveNum = 2;
  }

  while (i < sans.length) {
    const white = sans[i];
    const black = sans[i + 1];
    if (black) {
      parts.push(`${moveNum}. ${white} ${black}`);
      i += 2;
    } else {
      parts.push(`${moveNum}. ${white}`);
      i += 1;
    }
    moveNum += 1;
  }
  return parts.join('  ');
}

export class PuzzleSession {
  private puzzle: LocalPuzzle | null = null;
  private game = new Chess();
  private setupUci = '';
  private startFen = '';
  private orientation: PuzzleOrientation = 'w';
  /** Next expected index in puzzle.moves (starts at 1 after load). */
  private solutionIndex = 1;
  private stats: PuzzleAttemptStats = emptyPuzzleStats();
  /** Whether the current user plie has already had a wrong chess attempt. */
  private triedCurrent = false;
  private done = false;

  get isLoaded(): boolean {
    return this.puzzle != null;
  }

  get currentPuzzle(): LocalPuzzle | null {
    return this.puzzle;
  }

  getStats(): PuzzleAttemptStats {
    return { ...this.stats };
  }

  setStats(stats: PuzzleAttemptStats): void {
    this.stats = { ...stats, helps: { ...stats.helps } };
  }

  getFinalStats(): PuzzleAttemptStats {
    return finalizePuzzleStats(this.stats);
  }

  getSolutionIndex(): number {
    return this.solutionIndex;
  }

  getFen(): string {
    return this.game.fen();
  }

  getStartFen(): string {
    return this.startFen;
  }

  getSideToMove(): 'w' | 'b' {
    return this.game.turn();
  }

  getOrientation(): PuzzleOrientation {
    return this.orientation;
  }

  getSetupUci(): string {
    return this.setupUci;
  }

  isComplete(): boolean {
    return this.done;
  }

  getChess(): Chess {
    return this.game;
  }

  /**
   * Load a puzzle: set source FEN, apply moves[0] as setup, ready for moves[1].
   */
  load(puzzle: LocalPuzzle): PuzzleSessionSnapshot {
    if (!puzzle.moves || puzzle.moves.length < 2) {
      throw new Error('Puzzle invalide : il faut au moins un coup de mise en place et un coup à trouver.');
    }

    this.puzzle = puzzle;
    this.game = new Chess(puzzle.fen);
    this.setupUci = normalizeUci(puzzle.moves[0]);
    const setupMove = tryApplyUci(this.game, this.setupUci);
    if (!setupMove) {
      throw new Error(`Coup de mise en place invalide pour ${puzzle.id}: ${puzzle.moves[0]}`);
    }

    this.startFen = this.game.fen();
    this.orientation = this.game.turn();
    this.solutionIndex = 1;
    this.triedCurrent = false;
    this.done = false;
    this.stats = emptyPuzzleStats(countUserPlies(puzzle.moves));
    return this.snapshot();
  }

  /**
   * Reset board to the actual puzzle start (after setup), keep stats flags
   * related to solution request.
   */
  resetToStart(): void {
    if (!this.puzzle) return;
    this.game = new Chess(this.puzzle.fen);
    applyUci(this.game, this.setupUci);
    this.startFen = this.game.fen();
    this.solutionIndex = 1;
    this.triedCurrent = false;
    this.done = false;
  }

  snapshot(): PuzzleSessionSnapshot {
    if (!this.puzzle) {
      throw new Error('Aucun problème chargé.');
    }
    return {
      puzzle: this.puzzle,
      setupUci: this.setupUci,
      startFen: this.startFen,
      fen: this.game.fen(),
      sideToMove: this.game.turn(),
      orientation: this.orientation,
      solutionIndex: this.solutionIndex,
      done: this.done,
      stats: { ...this.stats },
    };
  }

  expectedUci(): string | null {
    if (!this.puzzle || this.done) return null;
    return this.puzzle.moves[this.solutionIndex]
      ? normalizeUci(this.puzzle.moves[this.solutionIndex])
      : null;
  }

  /**
   * Attempt a user move from chess.js Move fields / squares.
   */
  attemptMove(from: string, to: string, promotion?: string | null): PuzzleAttemptOutcome {
    return this.attemptUserUci(uciFromSquares(from, to, promotion));
  }

  attemptFromChessMove(move: Move): PuzzleAttemptOutcome {
    return this.attemptUserUci(uciFromSquares(move.from, move.to, move.promotion));
  }

  /**
   * Validate and apply a user UCI against the next expected solution move.
   * On success, auto-plays the following opponent move when present.
   */
  attemptUserUci(uci: string): PuzzleAttemptOutcome {
    if (!this.puzzle || this.done) return { result: 'complete' };

    const expected = this.expectedUci();
    if (!expected) {
      this.done = true;
      this.stats.solved = true;
      this.stats = finalizePuzzleStats(this.stats);
      return { result: 'complete' };
    }

    // Legality probe on a clone so we never mutate on wrong/illegal attempts.
    const probe = new Chess(this.game.fen());
    const legalMove = tryApplyUci(probe, normalizeUci(uci));
    if (!legalMove) {
      return { result: 'illegal' };
    }

    if (!isExpectedMove(expected, uci)) {
      this.stats.wrongChessMoves += 1;
      this.triedCurrent = true;
      return { result: 'wrong-legal' };
    }

    // Correct — score first-attempt if this plie was clean.
    if (!this.triedCurrent) {
      this.stats.correctOnFirstAttempt += 1;
    }
    this.triedCurrent = false;

    const userMove = applyUci(this.game, expected);
    this.solutionIndex += 1;

    let opponentMove: Move | undefined;
    // Auto-play opponent reply if any.
    if (this.solutionIndex < this.puzzle.moves.length) {
      const replyUci = normalizeUci(this.puzzle.moves[this.solutionIndex]);
      const reply = tryApplyUci(this.game, replyUci);
      if (!reply) {
        throw new Error(`Coup adverse invalide à l'index ${this.solutionIndex}: ${replyUci}`);
      }
      opponentMove = reply;
      this.solutionIndex += 1;
    }

    if (this.solutionIndex >= this.puzzle.moves.length) {
      this.done = true;
      this.stats.solved = true;
      this.stats = finalizePuzzleStats(this.stats);
      return { result: 'complete', userMove, opponentMove };
    }

    return { result: 'correct', userMove, opponentMove };
  }

  recordRecognitionFailure(): void {
    this.stats.recognitionFailures += 1;
  }

  /**
   * Mark solution as requested (not solved without help) and return the
   * remaining user-facing SAN line from the current position / index.
   */
  requestSolution(): string {
    this.stats.solutionRequested = true;
    this.stats.solvedWithoutHelp = false;
    return this.getRemainingUserFacingSolutionSans();
  }

  /**
   * Full user-facing solution SAN line (from index 1), on a clone from source FEN + setup.
   */
  getUserFacingSolutionSans(): string[] {
    if (!this.puzzle) return [];
    const clone = new Chess(this.puzzle.fen);
    applyUci(clone, this.setupUci);
    const sans: string[] = [];
    for (let i = 1; i < this.puzzle.moves.length; i++) {
      const m = tryApplyUci(clone, normalizeUci(this.puzzle.moves[i]));
      if (!m) break;
      sans.push(m.san);
    }
    return sans;
  }

  getUserFacingSolutionLine(): string {
    const startsWithBlack = this.startFen
      ? new Chess(this.startFen).turn() === 'b'
      : false;
    return formatNumberedSanLine(this.getUserFacingSolutionSans(), startsWithBlack);
  }

  /** Remaining SAN from the current solutionIndex onward. */
  getRemainingUserFacingSolutionSans(): string {
    if (!this.puzzle) return '';
    const clone = new Chess(this.game.fen());
    const startsWithBlack = clone.turn() === 'b';
    const sans: string[] = [];
    for (let i = this.solutionIndex; i < this.puzzle.moves.length; i++) {
      const m = tryApplyUci(clone, normalizeUci(this.puzzle.moves[i]));
      if (!m) break;
      sans.push(m.san);
    }
    return formatNumberedSanLine(sans, startsWithBlack);
  }

  /**
   * Build replay moves for the full user-facing solution (excludes setup).
   * Starts from the post-setup position.
   */
  buildSolutionReplayMoves(): PuzzleReplayMove[] {
    if (!this.puzzle) return [];
    const clone = new Chess(this.puzzle.fen);
    applyUci(clone, this.setupUci);
    const out: PuzzleReplayMove[] = [];
    for (let i = 1; i < this.puzzle.moves.length; i++) {
      const uci = normalizeUci(this.puzzle.moves[i]);
      const m = tryApplyUci(clone, uci);
      if (!m) break;
      out.push({
        san: m.san,
        from: m.from,
        to: m.to,
        promotion: m.promotion,
        uci: uciFromSquares(m.from, m.to, m.promotion),
        verbal: verbalMove(m),
        color: m.color,
      });
    }
    return out;
  }

  static verbalForSan(san: string): string {
    return sanToVerbal(san);
  }
}
