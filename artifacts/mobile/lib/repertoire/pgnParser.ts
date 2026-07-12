/**
 * A small, dependency-free PGN parser.
 *
 * Responsibilities:
 *   - Split a PGN file into individual games (headers + movetext).
 *   - Tokenise movetext, honouring comments `{ ... }`, line comments `;`,
 *     recursive variations `( ... )`, NAGs `$n`, move numbers and results.
 *   - Build a move tree that keeps EVERY branch (main line and all nested
 *     variations), not just the main line.
 *
 * It performs no chess legality checking — that happens in `repertoireTree.ts`
 * while walking the tree with chess.js, so illegal moves can be reported with
 * their surrounding context. Keeping parsing and validation separate keeps
 * each piece simple and testable.
 */
import type { PgnHeaders } from './types';

/** One move in the parsed tree. */
export interface PgnMoveNode {
  /** SAN as written in the PGN (annotation glyphs like !? stripped). */
  san: string;
  comment?: string;
  nags: string[];
  /**
   * Alternative first-moves that replace THIS move (standard PGN variation
   * semantics: a `( ... )` following a move gives alternatives to that move).
   */
  variations: PgnMoveNode[];
  /** The next move in this line, or null at the end of the line. */
  next: PgnMoveNode | null;
}

export interface PgnGame {
  headers: PgnHeaders;
  /** First move of the main line, or null for an empty game. */
  root: PgnMoveNode | null;
}

// ── Game splitting ────────────────────────────────────────────────────────────

interface RawGame {
  headers: PgnHeaders;
  movetext: string;
}

const HEADER_RE = /^\[(\w+)\s+"(.*)"\]$/;

/** Split a (possibly multi-game) PGN string into raw header/movetext blocks. */
export function splitGames(pgn: string): RawGame[] {
  const games: RawGame[] = [];
  let headers: PgnHeaders = {};
  let moves: string[] = [];
  let inMoves = false;

  const flush = () => {
    if (Object.keys(headers).length > 0 || moves.length > 0) {
      games.push({ headers, movetext: moves.join(' ') });
    }
    headers = {};
    moves = [];
    inMoves = false;
  };

  for (const rawLine of pgn.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === '') continue;

    if (line.startsWith('[')) {
      // A header line appearing after movetext started signals a new game.
      if (inMoves) flush();
      const m = line.match(HEADER_RE);
      if (m) headers[m[1]] = m[2];
      continue;
    }

    inMoves = true;
    moves.push(line);
  }
  flush();
  return games;
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────

type Token =
  | { t: 'symbol'; v: string }
  | { t: 'comment'; v: string }
  | { t: 'nag'; v: string }
  | { t: 'open' }
  | { t: 'close' };

/** Thrown when parentheses/braces are unbalanced. */
export class PgnSyntaxError extends Error {}

export function tokenize(movetext: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = movetext.length;

  while (i < n) {
    const ch = movetext[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === '{') {
      const end = movetext.indexOf('}', i);
      if (end < 0) throw new PgnSyntaxError('Unterminated comment: missing "}"');
      tokens.push({ t: 'comment', v: movetext.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    if (ch === ';') {
      // Rest-of-line comment.
      const end = movetext.indexOf('\n', i);
      i = end < 0 ? n : end + 1;
      continue;
    }

    if (ch === '(') { tokens.push({ t: 'open' }); i++; continue; }
    if (ch === ')') { tokens.push({ t: 'close' }); i++; continue; }

    if (ch === '$') {
      const m = movetext.slice(i).match(/^\$\d+/);
      if (m) { tokens.push({ t: 'nag', v: m[0] }); i += m[0].length; continue; }
      i++; // stray '$'
      continue;
    }

    // A run of non-space, non-special characters: move number, SAN, or result.
    const m = movetext.slice(i).match(/^[^\s(){};]+/);
    const word = m ? m[0] : movetext[i];
    tokens.push({ t: 'symbol', v: word });
    i += word.length;
  }

  return tokens;
}

// ── Symbol classification ──────────────────────────────────────────────────────

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

function isResult(sym: string): boolean {
  return RESULTS.has(sym);
}

/**
 * Strip a leading move number ("12.", "12...") and trailing suggestion glyphs
 * ("!", "?", "!?", "‼", …) from a symbol, returning the bare SAN (may be "").
 */
function toSan(sym: string): string {
  let s = sym.replace(/^\d+\.(\.\.)?/, ''); // "12." or "12..."
  s = s.replace(/[!?]+$/g, '');             // keep + and # (chess.js needs them)
  return s.trim();
}

// ── Move-tree parser ────────────────────────────────────────────────────────────

/**
 * Parse a token stream into a move tree.
 * Returns the first move node of the (sub)line and the position after the
 * matching close paren (when called for a variation).
 */
function parseLine(tokens: Token[], start: number): { node: PgnMoveNode | null; pos: number } {
  let first: PgnMoveNode | null = null;
  let last: PgnMoveNode | null = null;
  let pos = start;

  while (pos < tokens.length) {
    const tk = tokens[pos];

    if (tk.t === 'close') { pos++; return { node: first, pos }; }

    if (tk.t === 'open') {
      const sub = parseLine(tokens, pos + 1);
      pos = sub.pos;
      if (last && sub.node) {
        // Variation is an alternative to the move just played (`last`).
        last.variations.push(sub.node);
      }
      continue;
    }

    if (tk.t === 'comment') {
      if (last) last.comment = last.comment ? `${last.comment} ${tk.v}` : tk.v;
      pos++;
      continue;
    }

    if (tk.t === 'nag') {
      if (last) last.nags.push(tk.v);
      pos++;
      continue;
    }

    // symbol
    if (isResult(tk.v)) { pos++; continue; }
    const san = toSan(tk.v);
    pos++;
    if (san === '') continue; // bare move number

    const node: PgnMoveNode = { san, nags: [], variations: [], next: null };
    if (!first) first = node;
    if (last) last.next = node;
    last = node;
  }

  return { node: first, pos };
}

/** Parse a full PGN string into games, each with a move tree. */
export function parsePgn(pgn: string): PgnGame[] {
  return splitGames(pgn).map(({ headers, movetext }) => {
    const tokens = tokenize(movetext);
    // Unbalanced parens: a stray close is ignored by parseLine (returns early);
    // an unbalanced open simply consumes to end. Detect gross imbalance here.
    const opens = tokens.filter((t) => t.t === 'open').length;
    const closes = tokens.filter((t) => t.t === 'close').length;
    if (opens !== closes) {
      throw new PgnSyntaxError(
        `Malformed variations: ${opens} "(" vs ${closes} ")" in movetext.`,
      );
    }
    const { node } = parseLine(tokens, 0);
    return { headers, root: node };
  });
}
