/**
 * Chess move keypad — pure buffer helpers (V3).
 *
 * Builds a French-facing move string (C/F/T/D/R, files, ranks, x, castling).
 * Does NOT validate legality or parse SAN — that stays in parseChessVoice /
 * applyUserMoveInput. Check / mate marks are not typed; the engine owns them.
 */

export const MOVE_KEYPAD_PIECES = ['C', 'F', 'T', 'D', 'R'] as const;
export const MOVE_KEYPAD_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const MOVE_KEYPAD_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const MOVE_KEYPAD_MARKS = ['x'] as const;
export const MOVE_KEYPAD_CASTLES = ['O-O', 'O-O-O'] as const;

export type MoveKeypadPiece = (typeof MOVE_KEYPAD_PIECES)[number];
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

export const MOVE_KEYPAD_A11Y: Record<
  MoveKeypadInsertToken | 'backspace' | 'clear',
  string
> = {
  C: 'Cavalier',
  F: 'Fou',
  T: 'Tour',
  D: 'Dame',
  R: 'Roi',
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

/** Strip accidental spaces; keep French SAN compact. */
export function normalizeMoveKeypadBuffer(buffer: string): string {
  return buffer.replace(/\s+/g, '');
}

export function trimMoveKeypadBuffer(buffer: string): string {
  return normalizeMoveKeypadBuffer(buffer).trim();
}

/**
 * Form-complete French move buffer (no legality check).
 * Complete when destination rank is present, or castling token.
 */
export function isCompleteMoveKeypadBuffer(buffer: string): boolean {
  const b = normalizeMoveKeypadBuffer(buffer);
  if (!b) return false;
  if (b === 'O-O' || b === 'O-O-O') return true;

  // Ignore legacy check/mate suffixes if present in buffer.
  const core = b.replace(/[+#]+$/u, '');

  return (
    /^[a-h][1-8]$/u.test(core) ||
    /^[a-h]x[a-h][1-8]$/u.test(core) ||
    /^[CFTDR][a-h][1-8]$/u.test(core) ||
    /^[CFTDR]x[a-h][1-8]$/u.test(core) ||
    /^[CFTDR][a-h][a-h][1-8]$/u.test(core) ||
    /^[CFTDR][1-8][a-h][1-8]$/u.test(core) ||
    /^[CFTDR][a-h][1-8][a-h][1-8]$/u.test(core) ||
    /^[CFTDR][a-h]x[a-h][1-8]$/u.test(core) ||
    /^[CFTDR][1-8]x[a-h][1-8]$/u.test(core) ||
    /^[CFTDR][a-h][1-8]x[a-h][1-8]$/u.test(core)
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
): ApplyMoveKeypadTokenResult {
  const value = appendMoveKeypadToken(buffer, token);
  return { value, readyToSubmit: isCompleteMoveKeypadBuffer(value) };
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
export function priorityMoveKeypadKeys(buffer: string): ReadonlySet<string> {
  const b = normalizeMoveKeypadBuffer(buffer);

  if (!b) {
    return setOf([...MOVE_KEYPAD_PIECES, ...MOVE_KEYPAD_FILES, ...MOVE_KEYPAD_CASTLES]);
  }

  if (b === 'O-O' || b === 'O-O-O' || isCompleteMoveKeypadBuffer(b)) {
    return setOf([]);
  }

  // Piece only: files / capture / rank disambiguation
  if (/^[CFTDR]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES, 'x', ...MOVE_KEYPAD_RANKS]);
  }

  // Piece + x → destination file
  if (/^[CFTDR]x$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  // Piece + file (Cf or Cb before disambiguation / destination)
  if (/^[CFTDR][a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS, 'x', ...MOVE_KEYPAD_FILES]);
  }

  // Piece + rank disambiguation (C5…)
  if (/^[CFTDR][1-8]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES, 'x']);
  }

  // Piece + file/rank + x
  if (/^[CFTDR](?:[a-h]|[1-8]|[a-h][1-8])x$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  // Piece move ending on a file awaiting rank (Cxf, Cf, Cbd, C5e, …)
  if (/^[CFTDR].*[a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS]);
  }

  // Pawn file
  if (/^[a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS, 'x']);
  }

  // Pawn capture: ex → file
  if (/^[a-h]x$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_FILES]);
  }

  // Pawn capture file: exd → rank
  if (/^[a-h]x[a-h]$/u.test(b)) {
    return setOf([...MOVE_KEYPAD_RANKS]);
  }

  return setOf([
    ...MOVE_KEYPAD_PIECES,
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
