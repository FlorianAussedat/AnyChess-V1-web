/**
 * Continue-la-ligne — pure types (no React / speech).
 */
import type { RepertoireMoveChoice } from '../repertoire/types.ts';

export type ContinueLinePhase =
  | 'loading'
  | 'ready'
  | 'reciting'
  | 'completed'
  | 'failed'
  | 'error';

export type ContinueLineAttemptKind =
  | 'correct'
  | 'wrong'
  | 'recognition-failure'
  | 'ambiguous';

export interface ContinueLinePath {
  /** Unique-ish id for recent-history (sans joined). */
  id: string;
  sans: string[];
  /** FEN before each half-move (same length as sans). */
  fensBefore: string[];
  choices: RepertoireMoveChoice[];
  /** Optional source hints from PGN headers. */
  sourceLabel?: string;
}

export interface ContinueLineSessionSnapshot {
  phase: ContinueLinePhase;
  repertoireName: string;
  sourceLabel: string | null;
  /** Folder this line comes from (mixed training). */
  folderId?: string;
  /** Training side for board orientation. */
  trainingSide?: 'white' | 'black';
  /** Cue (moves shown/dictated before the user continues). */
  preambleSans: string[];
  /** FEN where the user starts answering. */
  startFen: string;
  /** 0-based ply index of the first user half-move in the full path. */
  startPly: number;
  /** Current FEN during recitation. */
  currentFen: string;
  /** How many correct user half-moves so far. */
  correctCount: number;
  /** Book moves still available at the current node (SAN). */
  availableSans: string[];
  /** First wrong attempt, if any. */
  incorrectSan: string | null;
  /** Valid repertoire alternatives at the failure node. */
  validAlternatives: string[];
  /** Proposed continuation after failure (or after completion: empty). */
  proposedContinuation: string[];
  /** True when the user reached a repertoire leaf successfully. */
  lineCompleted: boolean;
  errorMessage: string | null;
}

export interface ContinueLineResult {
  repertoireName: string;
  sourceLabel: string | null;
  correctHalfMoves: number;
  incorrectSan: string | null;
  validAlternatives: string[];
  proposedContinuation: string[];
  lineCompleted: boolean;
  preambleSans: string[];
}
