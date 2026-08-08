/**
 * Shared types for the chess voice command pipeline.
 *
 * Audio/STT providers (Web Speech today, native Android later) feed a raw
 * transcript string into this layer. Nothing here depends on Web Speech APIs.
 */
import type { Move } from 'chess.js';

/** Game / training mode that filters which app commands are active. */
export type VoiceMode = 'classic' | 'opening' | 'puzzle' | 'blind' | 'any';

/** Application-level voice commands (not chess moves). */
export type AppVoiceCommand =
  | 'undo'
  | 'repeat'
  | 'repeat_position'
  | 'summarize'
  | 'solution';

/** A legal chess.js move resolved from spoken input. */
export type ResolvedChessMove = Move;

/**
 * Structured result of parsing a raw transcript.
 *
 * Distinguishes speech-understanding failures from chess errors so scoring
 * (Blind Sequence, Puzzles, etc.) can treat them differently.
 */
export type VoiceParseResult =
  | {
      type: 'move';
      move: ResolvedChessMove;
      confidence: number;
      rawTranscript: string;
      normalizedTranscript: string;
    }
  | {
      type: 'command';
      command: AppVoiceCommand;
      confidence: number;
      rawTranscript: string;
      normalizedTranscript: string;
    }
  | {
      type: 'ambiguous';
      candidates: ResolvedChessMove[];
      rawTranscript: string;
      normalizedTranscript: string;
      reason?: string;
    }
  | {
      /** Intention understood, but no matching legal move in the position. */
      type: 'illegal';
      rawTranscript: string;
      normalizedTranscript: string;
      reason?: string;
      /** Best-effort description (SAN-like) of what was said. */
      intendedDescription?: string;
    }
  | {
      type: 'unrecognized';
      rawTranscript: string;
      normalizedTranscript: string;
      reason?: string;
    };

/** Options for the top-level voice parser. */
export type ParseChessVoiceOptions = {
  /** Controls which app commands are accepted. Default: `'any'`. */
  mode?: VoiceMode;
  /**
   * Default promotion piece when a pawn reaches the last rank without one.
   * Architecture-ready for other pieces later.
   */
  defaultPromotion?: 'q' | 'r' | 'b' | 'n';
  /**
   * Active chess notation preference. When omitted, reads PreferencesStore.
   * Selected notation wins when English rook `R` and French Roi `R` collide.
   */
  chessNotation?: 'fr' | 'en';
};

/**
 * Structured intent extracted from a transcript before legal-move resolution.
 * Kept internal to the voice package but useful for diagnostics/tests.
 */
export type MoveIntent = {
  castle?: 'kingside' | 'queenside';
  /** Chess.js piece letter; pawn is `'p'`. */
  piece?: 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
  fromFile?: string;
  fromRank?: string;
  fromSquare?: string;
  to?: string;
  capture?: boolean;
  promotion?: 'q' | 'r' | 'b' | 'n';
  /** Spoken check/mate suffix was present; ignored for legality. */
  checkHint?: boolean;
};

/** Legacy ParseResult shape used by existing contexts (compat layer). */
export type LegacyParseResult =
  | { kind: 'move'; move: Move }
  | { kind: 'ambiguous'; guess: Move; candidates?: Move[] }
  | { kind: 'illegal'; reason?: string }
  | { kind: 'unknown' };
