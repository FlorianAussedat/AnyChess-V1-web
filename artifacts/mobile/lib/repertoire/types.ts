/**
 * Types for the opening-repertoire system.
 *
 * This module is fully independent: it knows nothing about Stockfish, the UI,
 * voice, or GameContext. It only turns PGN text into a position-keyed move
 * tree that can later be consulted by a move source (e.g. a future
 * RepertoireEngine) to decide whether to play a book move or hand control back
 * to the engine.
 */

/** A single candidate move available from some position. */
export interface RepertoireMoveChoice {
  /** Standard algebraic notation, as validated/normalised by chess.js. */
  san: string;
  /** Long algebraic (UCI) form: from + to + optional promotion, e.g. "e7e8q". */
  uci: string;
  from: string;
  to: string;
  promotion?: string;
  /** Trailing `{ ... }` comment attached to the move, if any. */
  comment?: string;
  /** Numeric Annotation Glyphs (e.g. "$1"), preserved for later use. */
  nags: string[];
  /**
   * Relative selection weight for future weighted-random choice.
   * Defaults to 1. Not interpreted yet beyond the selection helpers.
   */
  weight: number;
  /**
   * Free-form tags for future filtering (e.g. "main", "sideline").
   * Not populated by the parser yet — reserved for future settings.
   */
  tags: string[];
  /** Full FEN of the position reached after playing this move. */
  fenAfter: string;
}

/**
 * All repertoire moves available from one position. Keyed in the index by a
 * position key (FEN minus the halfmove/fullmove counters) so that different
 * move orders transposing into the same position share the same node.
 */
export interface RepertoireNode {
  /** Position key (piece placement + side + castling + en passant). */
  positionKey: string;
  /** A representative full FEN of this position (first one encountered). */
  fen: string;
  moves: RepertoireMoveChoice[];
}

export type PgnHeaders = Record<string, string>;

/** A problem found while importing a PGN. */
export interface RepertoireIssue {
  message: string;
  /** The offending token / SAN / snippet, when applicable. */
  context?: string;
  /** Index of the game within the PGN file (0-based), when applicable. */
  game?: number;
}

/** Result of importing one or more PGN games into a repertoire. */
export interface ParsedRepertoire {
  /** Position-keyed index enabling O(1) lookup and transposition matching. */
  index: Map<string, RepertoireNode>;
  /** Headers for each game encountered, in order. */
  headers: PgnHeaders[];
  /** Hard errors (illegal moves, malformed variations, unparsable games). */
  errors: RepertoireIssue[];
  /** Non-fatal warnings (e.g. duplicate lines, ignored tokens). */
  warnings: RepertoireIssue[];
  /** Number of (position → move) branches ingested, before de-duplication. */
  branchCount: number;
  /** Number of distinct positions in the index. */
  positionCount: number;
}

/** How to pick among several repertoire moves for a position. */
export type RepertoireSelectionMode =
  | 'first'              // deterministic: the first line encountered
  | 'main-line-only'     // only ever the primary continuation
  | 'uniform-random'     // pick uniformly among all candidates
  | 'weighted-random'    // pick by `weight`
  | 'rare-sidelines';    // bias toward the least-weighted candidates

/** Future-facing selection settings; only `mode`/`rng` are used for now. */
export interface RepertoireSelectionSettings {
  mode: RepertoireSelectionMode;
  /**
   * Strict repertoire mode placeholder: when true, callers should treat a
   * position with no repertoire move as "out of book" rather than improvising.
   * (The parser/selector expose this flag; enforcement is the caller's job.)
   */
  strict?: boolean;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  rng?: () => number;
}
