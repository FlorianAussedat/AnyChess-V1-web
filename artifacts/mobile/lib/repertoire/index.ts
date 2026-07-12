/**
 * Opening-repertoire module — public surface.
 *
 * Independent of Stockfish and the UI. Turns PGN text (main lines + nested
 * variations + comments, one opening per file or many) into a position-keyed
 * move tree that supports transpositions, then lets a caller choose a book
 * move for the current position or detect that play has left the repertoire.
 *
 * Intended future use (not wired yet): a `RepertoireEngine implements
 * ChessEngine` consults `chooseRepertoireMove` first and delegates to
 * Stockfish once `chooseRepertoireMove` returns null.
 */
export {
  buildRepertoire,
  chooseRepertoireMove,
  hasPosition,
  movesForPosition,
  positionKey,
  DEFAULT_FEN,
} from './repertoireTree';
export { parsePgn, tokenize, splitGames, PgnSyntaxError } from './pgnParser';
export type { PgnGame, PgnMoveNode } from './pgnParser';
export type {
  ParsedRepertoire,
  RepertoireIssue,
  RepertoireMoveChoice,
  RepertoireNode,
  RepertoireSelectionMode,
  RepertoireSelectionSettings,
  PgnHeaders,
} from './types';
