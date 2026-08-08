/**
 * Chess move keypad — pure buffer helpers (V3).
 *
 * Builds a notation-facing move string (FR: C/F/T/D/R or EN: N/B/R/Q/K).
 * Does NOT validate legality or parse SAN — that stays in parseChessVoice /
 * applyUserMoveInput. Check / mate marks are not typed; the engine owns them.
 */
import type { ChessNotation } from '../preferences/types.ts';
import { keypadPieceClass, keypadPieceLetters } from '../chess/notation.ts';

/** @deprecated Prefer keypadPieceLetters(notation). Default French. */
export const MOVE_KEYPAD_PIECES = ['C', 'F', 'T', 'D', 'R'] as const;
export const MOVE_KEYPAD_PIECES_EN = ['N', 'B', 'R', 'Q', 'K'] as const;
export const MOVE_KEYPAD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const MOVE_KEYPAD_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const MOVE_KEYPAD_MARKS = ['x'] as const;
export const MOVE_KEYPAD_CASTLES = ['O-O', 'O-O-O'] as const;

export type MoveKeypadPiece =
  | (typeof MOVE_KEYPAD_PIECES)[number]
  | (typeof MOVE_KEYPAD_PIECES_EN)[number];
export type MoveKeypadFile = (typeof MOVE_KEYPAD_FILES)[number];
export type MoveKeypadRank = (typeof MOVE_KEYPAD_RANKS)[number];
export type MoveKeypadMark = (typeof MOVE_KEYPAD_MARKS)[number];
export type MoveKeypadCastle = (typeof MOVE_KEYPAD_CASTLES)[number];

export type MoveKeypadInsertToken =
  | MoveKeypadPiece
  | MoveKeypadFile
  | MoveKeypadRank
  | MoveKeypadMark
  | MoveKeypadCastle;

export function moveKeypadPiecesForNotation(
  notation: ChessNotation,
): readonly MoveKeypadPiece[] {
  return keypadPieceLetters(notation);
}

export const MOVE_KEYPAD_A11Y_FR: Record<
  MoveKeypadInsertToken | 'backspace' | 'clear',
  string
> = {
  C: 'Cavalier',
  F: 'Fou',
  T: 'Tour',
  D: 'Dame',
  R: 'Roi',
  N: 'Cavalier',
  B: 'Fou',
  Q: 'Dame',
  K: 'Roi',
  a: 'Colonne a',
  b: 'Colonne b',
  c: 'Colonne c',
  d: 'Colonne d',
  e: 'Colonne e',
  f: 'Colonne f',
  g: 'Colonne g',
  h: 'Colonne h',
  '1': 'Rangée 1',
  '2': 'Rangée 2',
  '3': 'Rangée 3',
  '4': 'Rangée 4',
  '5': 'Rangée 5',
  '6': 'Rangée 6',
  '7': 'Rangée 7',
  '8': 'Rangée 8',
  x: 'Prise',
  'O-O': 'Petit roque',
  'O-O-O': 'Grand roque',
  backspace: 'Effacer un caractère',
  clear: 'Effacer la saisie',
};

export const MOVE_KEYPAD_A11Y_EN: Record<
  MoveKeypadInsertToken | 'backspace' | 'clear',
  string
> = {
  C: 'Knight',
  F: 'Bishop',
  T: 'Rook',
  D: 'Queen',
  // Ambiguous letter R: resolved in moveKeypadA11y via chessNotation.
  R: 'Rook',
  N: 'Knight',
  B: 'Bishop',
  Q: 'Queen',
  K: 'King',
  a: 'File a',
  b: 'File b',
  c: 'File c',
  d: 'File d',
  e: 'File e',
  f: 'File f',
  g: 'File g',
  h: 'File h',
  '1': 'Rank 1',
  '2': 'Rank 2',
  '3': 'Rank 3',
  '4': 'Rank 4',
  '5': 'Rank 5',
  '6': 'Rank 6',
  '7': 'Rank 7',
  '8': 'Rank 8',
  x: 'Capture',
  'O-O': 'Kingside castling',
  'O-O-O': 'Queenside castling',
  backspace: 'Delete last character',
  clear: 'Clear input',
};

/** @deprecated Prefer MOVE_KEYPAD_A11Y_FR / language-aware lookup. */
export const MOVE_KEYPAD_A11Y = MOVE_KEYPAD_A11Y_FR;

export function moveKeypadA11y(
  token: MoveKeypadInsertToken | 'backspace' | 'clear',
  uiLanguage: 'fr' | 'en' = 'fr',
  chessNotation: ChessNotation = 'fr',
): string {
  // Letter R means King in French notation, Rook in English notation.
  if (token === 'R') {
    if (chessNotation === 'en') {
      return uiLanguage === 'en' ? 'Rook' : 'Tour';
    }
    return uiLanguage === 'en' ? 'King' : 'Roi';
  }
  return (uiLanguage === 'en' ? MOVE_KEYPAD_A11Y_EN : MOVE_KEYPAD_A11Y_FR)[token];
}

/** Strip accidental spaces; keep SAN compact. */
export function normalizeMoveKeypadBuffer(buffer: string): string {
  return buffer.replace(/\s+/g, '');
}

export function trimMoveKeypadBuffer(buffer: string): string {
  return normalizeMoveKeypadBuffer(buffer).trim();
}

/**
 * Form-complete move buffer (no legality check).
 * Complete when destination rank is present, or castling token.
 */
export function isCompleteMoveKeypadBuffer(
  buffer: string,
  notation: ChessNotation = 'fr',
): boolean {
  const b = normalizeMoveKeypadBuffer(buffer);
  if (!b) return false;
  if (b === 'O-O' || b === 'O-O-O') return true;

  const core = b.replace(/[+#]+$/u, '');
  const P = keypadPieceClass(notation);

  return (
    /^[a-h][1-8]$/u.test(core) ||
    /^[a-h]x[a-h][1-8]$/u.test(core) ||
    new RegExp(`^[${P}][a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}]x[a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][a-h][a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][1-8][a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][a-h][1-8][a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][a-h]x[a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][1-8]x[a-h][1-8]$`, 'u').test(core) ||
    new RegExp(`^[${P}][a-h][1-8]x[a-h][1-8]$`, 'u').test(core)
  );
}

/** @deprecated Prefer isCompleteMoveKeypadBuffer for auto-submit gating. */
export function canSubmitMoveKeypad(buffer: string): boolean {
  return isCompleteMoveKeypadBuffer(buffer);
}

/**
 * Append a keypad token. Castling replaces the buffer (complete move).
 * Pieces stay uppercase; files stay lowercase — tokens are already correct.
 */
export function appendMoveKeypadToken(
  buffer: string,
  token: MoveKeypadInsertToken,
): string {
  if (token === 'O-O' || token === 'O-O-O') return token;
  return normalizeMoveKeypadBuffer(buffer) + token;
}

export type ApplyMoveKeypadTokenResult = {
  value: string;
  readyToSubmit: boolean;
};

/** Append token and report whether the buffer is form-complete for auto-submit. */
export function applyMoveKeypadToken(
  buffer: string,
  token: MoveKeypadInsertToken,
  notation: ChessNotation = 'fr',
): ApplyMoveKeypadTokenResult {
  const value = appendMoveKeypadToken(buffer, token);
  return { value, readyToSubmit: isCompleteMoveKeypadBuffer(value, notation) };
}

/**
 * Logical backspace:
 * - whole castling token → empty
 * - otherwise last character
 */
export function backspaceMoveKeypad(buffer: string): string {
  const current = normalizeMoveKeypadBuffer(buffer);
  if (!current) return '';
  if (current === 'O-O' || current === 'O-O-O') return '';
  return current.slice(0, -1);
}

export function clearMoveKeypad(): string {
  return '';
}

function setOf(keys: readonly string[]): Set<string> {
  return new Set(keys);
}

/**
 * Plausible keys to highlight for the current buffer.
 * Never used to hard-disable keys — only visual priority.
 */
export function priorityMoveKeypadKeys(
  buffer: string,
  notation: ChessNotation = 'fr',
): ReadonlySet<string> {
  const b = normalizeMoveKeypadBuffer(buffer);
  const pieces = moveKeypadPiecesForNotation(notation);
  const P = keypadPieceClass(notation);

  if (!b) {
    return setOf([...pieces, ...MOVE_KEYPAD_FILES, ...MOVE_KEYPAD_CASTLES]);
  }

  if (b === 'O-O' || b === 'O-O-O' || isCompleteMoveKeypadBuffer(b, notation)) {
    return setOf([]);
  }

  if (new RegExp(`^[${P}]$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_FILES, 'x', ...MOVE_KEYPAD_RANKS]);
  }

  if (new RegExp(`^[${P}]x$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  if (new RegExp(`^[${P}][a-h]$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS, 'x', ...MOVE_KEYPAD_FILES]);
  }

  if (new RegExp(`^[${P}][1-8]$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_FILES, 'x']);
  }

  if (new RegExp(`^[${P}](?:[a-h]|[1-8]|[a-h][1-8])x$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  if (new RegExp(`^[${P}].*[a-h]$`, 'u').test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS]);
  }

  if (/^[a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS, 'x']);
  }

  if (/^[a-h]x$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  if (/^[a-h]x[a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS]);
  }

  return setOf([
    ...pieces,
    ...MOVE_KEYPAD_FILES,
    ...MOVE_KEYPAD_RANKS,
    ...MOVE_KEYPAD_MARKS,
    ...MOVE_KEYPAD_CASTLES,
  ]);
}

/** Apply a sequence of insert tokens (tests / helpers). */
export function buildMoveKeypadValue(
  tokens: readonly MoveKeypadInsertToken[],
): string {
  return tokens.reduce((acc, token) => appendMoveKeypadToken(acc, token), '');
}
