/**
 * Chess notation display / input helpers.
 *
 * Internal chess.js SAN, FEN, and PGN stay English/standard.
 * This module only formats for display and adapts keypad piece letters.
 */
import type { ChessNotation } from '../preferences/types.ts';
import { frenchSanToEnglish } from '../voice/resolveLegalMove.ts';

export type { ChessNotation };

const EN_TO_FR_PIECE: Record<string, string> = {
  N: 'C',
  B: 'F',
  R: 'T',
  Q: 'D',
  K: 'R',
};

const FR_TO_EN_PIECE: Record<string, string> = {
  C: 'N',
  F: 'B',
  T: 'R',
  D: 'Q',
  R: 'K',
};

/** Piece keys shown on the AnyChess move keypad for a notation. */
export function keypadPieceLetters(
  notation: ChessNotation,
): readonly ['C', 'F', 'T', 'D', 'R'] | readonly ['N', 'B', 'R', 'Q', 'K'] {
  return notation === 'en'
    ? (['N', 'B', 'R', 'Q', 'K'] as const)
    : (['C', 'F', 'T', 'D', 'R'] as const);
}

/** Character class for piece letters in keypad buffer regexes. */
export function keypadPieceClass(notation: ChessNotation): string {
  return notation === 'en' ? 'NBRQK' : 'CFTDR';
}

/**
 * Format an English/internal SAN for on-screen display.
 * Does not alter castling tokens beyond leaving them as-is.
 */
export function formatSanForDisplay(
  englishSan: string,
  notation: ChessNotation,
): string {
  if (!englishSan) return englishSan;
  if (notation === 'en') return englishSan;

  const castling = englishSan.match(/^(O-O-O|O-O|0-0-0|0-0)([+#]?)$/);
  if (castling) return englishSan;

  let out = '';
  let i = 0;
  const s = englishSan;

  // Leading piece letter
  if (/^[NBRQK]/.test(s)) {
    out += EN_TO_FR_PIECE[s[0]] ?? s[0];
    i = 1;
  }

  while (i < s.length) {
    const ch = s[i];
    if (ch === '=' && i + 1 < s.length && /[NBRQK]/.test(s[i + 1])) {
      out += '=' + (EN_TO_FR_PIECE[s[i + 1]] ?? s[i + 1]);
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Format a list of English SANs for display. */
export function formatSansForDisplay(
  englishSans: readonly string[],
  notation: ChessNotation,
): string[] {
  return englishSans.map((san) => formatSanForDisplay(san, notation));
}

/**
 * Format a numbered move token such as "5.Nf3" / "8...Bg7" for display.
 * Leaves the move-number prefix untouched.
 */
export function formatNumberedSanForDisplay(
  numbered: string,
  notation: ChessNotation,
): string {
  if (!numbered || notation === 'en') return numbered;
  const m = numbered.match(/^(\d+\.+\s*)(.+)$/u);
  if (m) return m[1] + formatSanForDisplay(m[2], notation);
  return formatSanForDisplay(numbered, notation);
}

/** Format a space-separated SAN / numbered-SAN line for display. */
export function formatSanLineForDisplay(
  line: string,
  notation: ChessNotation,
): string {
  if (!line || notation === 'en') return line;
  return line
    .split(/(\s+)/u)
    .map((part) => {
      if (!part || /^\s+$/u.test(part)) return part;
      return formatNumberedSanForDisplay(part, notation);
    })
    .join('');
}

/**
 * Normalize user-typed / keypad move text to English SAN for chess.js.
 * Accepts French or English piece letters (parseChessVoice path).
 */
export function normalizeMoveInputToEnglish(raw: string): string {
  return frenchSanToEnglish(raw.trim());
}

/** Labels for notation preference UI. */
export function chessNotationLabel(
  notation: ChessNotation,
  uiLanguage: 'fr' | 'en',
): string {
  if (uiLanguage === 'en') {
    return notation === 'fr' ? 'French' : 'English / International';
  }
  return notation === 'fr' ? 'Française' : 'English / Internationale';
}

export { EN_TO_FR_PIECE, FR_TO_EN_PIECE };
