/**
 * Blind-sequence training — pure types (no UI / React).
 */
import type { Move } from 'chess.js';

export type BlindSubmode = 'listen-reconstruct' | 'watch-recite';

export type BlindPhase =
  | 'hub'
  | 'settings'
  | 'generating'
  | 'dictation'
  | 'observing'
  | 'reconstruction'
  | 'recitation'
  | 'results';

export type BlindOrientation = 'w' | 'b';

export type ObservationPace = 'slow' | 'normal' | 'fast';

export const OBSERVATION_DELAY_MS: Record<ObservationPace, number> = {
  slow: 1600,
  normal: 900,
  fast: 450,
};

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
  | 'wrong-move'
  | 'help'
  | 'recognition-failure';

export interface BlindAttemptRecord {
  expectedIndex: number;
  kind: BlindErrorKind;
  attemptedSan?: string;
}

export interface BlindScore {
  totalHalfMoves: number;
  correctOnFirstAttempt: number;
  accuracyPercent: number;
  wrongPiece: number;
  wrongDestination: number;
  wrongOrder: number;
  wrongMove: number;
  helpsUsed: number;
  recognitionFailures: number;
}

export interface BlindSessionConfig {
  orientation: BlindOrientation;
  fullMoves: number;
  submode: BlindSubmode;
  pace?: ObservationPace;
}

export function halfMoveCount(fullMoves: number): number {
  return Math.max(1, Math.min(20, Math.round(fullMoves))) * 2;
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
