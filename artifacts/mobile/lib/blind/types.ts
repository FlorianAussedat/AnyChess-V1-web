/**
 * Blind-sequence training — pure types (no UI / React).
 */
import type { Move } from 'chess.js';

export type BlindPhase = 'settings' | 'generating' | 'dictation' | 'reconstruction' | 'results';

export type BlindOrientation = 'w' | 'b';

/** One half-move in the memorised sequence. */
export interface BlindSequenceMove {
  san: string;
  from: string;
  to: string;
  promotion?: string;
  piece: string;
  color: 'w' | 'b';
  /** Spoken French announcement. */
  verbal: string;
  uci: string;
}

export type BlindErrorKind =
  | 'wrong-piece'
  | 'wrong-destination'
  | 'wrong-order'
  | 'help';

export interface BlindAttemptRecord {
  /** Index in the sequence (0-based half-move). */
  expectedIndex: number;
  kind: BlindErrorKind;
  /** Attempted SAN when applicable. */
  attemptedSan?: string;
}

export interface BlindScore {
  totalHalfMoves: number;
  correctOnFirstAttempt: number;
  /** Round percentage 0–100. */
  accuracyPercent: number;
  wrongPiece: number;
  wrongDestination: number;
  wrongOrder: number;
  helpsUsed: number;
}

export interface BlindSessionConfig {
  orientation: BlindOrientation;
  /** Number of full moves (White+Black pairs). */
  fullMoves: number;
}

export function halfMoveCount(fullMoves: number): number {
  return Math.max(1, Math.round(fullMoves)) * 2;
}

export function moveFromChessJs(m: Move, verbal: string): BlindSequenceMove {
  return {
    san: m.san,
    from: m.from,
    to: m.to,
    promotion: m.promotion,
    piece: m.piece,
    color: m.color,
    verbal,
    uci: `${m.from}${m.to}${m.promotion ?? ''}`,
  };
}
