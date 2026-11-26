/**
 * Reusable PGN exporter for finished (or in-progress) games.
 *
 * Independent of UI and engines. Classic and Opening modes both call this.
 * Opening Mode may pass per-ply comments/NAGs copied from the played PGN
 * branch, plus an optional theory-exit comment after the move that left book.
 */
import type { Move } from 'chess.js';

export interface PgnExportHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  White?: string;
  Black?: string;
  Result?: string;
  /** Opening name (ECO identification or repertoire label). */
  Opening?: string;
  /** Encyclopaedia of Chess Openings code, e.g. "C50". */
  Eco?: string;
  /** Free-form extra tags. */
  [key: string]: string | undefined;
}

export type PgnPlyAnnotation = {
  /** 0-based ply in `moves`. */
  ply: number;
  comment?: string;
  nags?: string[];
};

export interface PgnExportOptions {
  headers: PgnExportHeaders;
  /** Verbose history from chess.js (in order). */
  moves: Move[];
  /**
   * Optional comments / NAGs attached to specific plies (Opening Mode copies
   * these from the played PGN branch so the analyzer can display them).
   */
  plyAnnotations?: readonly PgnPlyAnnotation[];
  /**
   * Optional comment inserted AFTER the move at this 0-based ply
   * (e.g. theory exit). Comment text without braces.
   */
  commentAfterPly?: { ply: number; text: string };
}

function todayPgnDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitizeComment(text: string): string {
  return text.replace(/}/g, '').trim();
}

function formatNag(nag: string): string {
  const trimmed = nag.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('$') ? trimmed : `$${trimmed}`;
}

/**
 * Build a standard PGN string from moves + headers.
 */
export function exportGamePgn(options: PgnExportOptions): string {
  const headers: PgnExportHeaders = {
    Event: 'AnyChess',
    Site: 'AnyChess',
    Date: todayPgnDate(),
    Result: '*',
    ...options.headers,
  };

  const initialFen = options.moves[0]?.before;
  if (initialFen && initialFen !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') {
    headers.SetUp = '1'; headers.FEN = initialFen;
  }
  const lines: string[] = [];
  const order = ['Event', 'Site', 'Date', 'White', 'Black', 'Result', 'Opening', 'Eco'];
  const seen = new Set<string>();
  for (const key of order) {
    const val = headers[key];
    if (val != null && val !== '') {
      lines.push(`[${key} "${escapeHeader(val)}"]`);
      seen.add(key);
    }
  }
  for (const [key, val] of Object.entries(headers)) {
    if (seen.has(key) || val == null || val === '') continue;
    lines.push(`[${key} "${escapeHeader(val)}"]`);
  }
  lines.push('');

  const parts: string[] = [];
  const byPly = new Map<number, PgnPlyAnnotation>();
  for (const ann of options.plyAnnotations ?? []) {
    byPly.set(ann.ply, ann);
  }
  options.moves.forEach((move, ply) => {
    const fields = move.before.split(' ');
    const number = Number(fields[5]) || 1;
    if (move.color === 'w') parts.push(`${number}.`);
    else if (ply === 0) parts.push(`${number}...`);
    parts.push(move.san);
    const ann = byPly.get(ply);
    if (ann?.nags) {
      for (const nag of ann.nags) {
        const formatted = formatNag(nag);
        if (formatted) parts.push(formatted);
      }
    }
    if (ann?.comment) {
      const body = sanitizeComment(ann.comment);
      if (body) parts.push(`{${body}}`);
    }
    if (
      options.commentAfterPly &&
      options.commentAfterPly.ply === ply &&
      options.commentAfterPly.text
    ) {
      const body = sanitizeComment(options.commentAfterPly.text);
      if (body) parts.push(`{${body}}`);
    }
  });

  const result = headers.Result ?? '*';
  parts.push(result);
  lines.push(parts.join(' '));
  lines.push('');
  return lines.join('\n');
}

/** Derive a PGN Result tag from a finished chess.js game state. */
export function resultFromGame(opts: {
  isGameOver: boolean;
  isCheckmate: boolean;
  turn: 'w' | 'b';
  isDraw: boolean;
}): string {
  if (!opts.isGameOver) return '*';
  if (opts.isDraw) return '1/2-1/2';
  if (opts.isCheckmate) {
    // Side to move is the one who is mated.
    return opts.turn === 'w' ? '0-1' : '1-0';
  }
  return '*';
}

/** Explicit file result on every platform; native cancellation is not success. */
export async function downloadPgnFile(filename: string, pgn: string) {
  return (await import('../files/chessFileTransfer.ts')).transferChessText('file', filename, pgn, 'pgn');
}
export async function downloadFenFile(filename: string, fen: string) {
  return (await import('../files/chessFileTransfer.ts')).transferChessText('file', filename, fen, 'fen');
}

/** Example: AnyChess_2026-07-13_1430.pgn */
export function anyChessPgnFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `AnyChess_${yyyy}-${mm}-${dd}_${hh}${mi}.pgn`;
}
