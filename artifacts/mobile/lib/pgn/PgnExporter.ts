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
    if (ply % 2 === 0) {
      parts.push(`${Math.floor(ply / 2) + 1}.`);
    }
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

/**
 * Trigger a .pgn download in the browser, or return the text for the caller
 * to share/copy on native.
 */
export function downloadPgnFile(filename: string, pgn: string): void {
  if (typeof document === 'undefined') return;
  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.pgn') ? filename : `${filename}.pgn`;
  a.click();
  URL.revokeObjectURL(url);
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
