/**
 * French / English chess vocabulary for voice parsing.
 * Piece letters follow FIDE SAN for English, French algebraic for French.
 */

export type PieceLetter = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** French algebraic piece letters → chess.js piece. */
export const FR_SAN_TO_PIECE: Record<string, PieceLetter> = {
  R: 'k', // Roi
  D: 'q', // Dame
  T: 'r', // Tour
  F: 'b', // Fou
  C: 'n', // Cavalier
  P: 'p', // Pion (rarely written)
};

/** English SAN piece letters → chess.js piece. */
export const EN_SAN_TO_PIECE: Record<string, PieceLetter> = {
  K: 'k',
  Q: 'q',
  R: 'r',
  B: 'b',
  N: 'n',
  P: 'p',
};

/** chess.js piece → French SAN letter */
export const PIECE_TO_FR_SAN: Record<PieceLetter, string> = {
  k: 'R',
  q: 'D',
  r: 'T',
  b: 'F',
  n: 'C',
  p: '',
};

/** chess.js piece → English SAN letter */
export const PIECE_TO_EN_SAN: Record<PieceLetter, string> = {
  k: 'K',
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
  p: '',
};

/** Spoken piece names (normalized, accent-stripped) → piece letter. */
export const SPOKEN_PIECE_TO_LETTER: Record<string, PieceLetter> = {
  // French
  roi: 'k',
  dame: 'q',
  tour: 'r',
  fou: 'b',
  cavalier: 'n',
  pion: 'p',
  // English
  king: 'k',
  queen: 'q',
  rook: 'r',
  bishop: 'b',
  knight: 'n',
  pawn: 'p',
};

export const SPOKEN_RANK: Record<string, string> = {
  // French
  un: '1',
  une: '1',
  deux: '2',
  trois: '3',
  quatre: '4',
  cinq: '5',
  six: '6',
  sept: '7',
  huit: '8',
  // English
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six_en: '6', // unused key collision avoided below
  seven: '7',
  eight: '8',
};

/** Spoken / STT file-letter variants → a–h. Conservative: phonetic forms only. */
export const FILE_PHONETICS: Record<string, string> = {
  a: 'a',
  ah: 'a',
  b: 'b',
  be: 'b',
  bi: 'b',
  bais: 'b',
  bay: 'b',
  bee: 'b',
  c: 'c',
  ce: 'c',
  se: 'c',
  sa: 'c',
  say: 'c',
  see: 'c',
  d: 'd',
  de: 'd',
  des: 'd',
  du: 'd',
  day: 'd',
  dee: 'd',
  e: 'e',
  et: 'e',
  est: 'e',
  eh: 'e',
  ee: 'e',
  f: 'f',
  eff: 'f',
  ef: 'f',
  effe: 'f',
  effet: 'f', // common FR STT for "F"
  aif: 'f',
  g: 'g',
  ge: 'g',
  gee: 'g',
  je: 'g',
  jai: 'g',
  jay: 'g',
  h: 'h',
  ache: 'h',
  aiche: 'h',
  ha: 'h',
  aitch: 'h',
};

/**
 * STT contextual bias strings for speech engines.
 * Kept with vocabulary so Android / Web can share the same list.
 */
export const CHESS_CONTEXT_STRINGS: string[] = [
  'dame',
  'cavalier',
  'fou',
  'tour',
  'roi',
  'pion',
  'queen',
  'knight',
  'bishop',
  'rook',
  'king',
  'pawn',
  'petit roque',
  'grand roque',
  'roque',
  'promotion',
  'kingside castle',
  'queenside castle',
  'prend',
  'takes',
  'en passant',
  'échec',
  'mat',
  'échec et mat',
  'check',
  'checkmate',
  'annuler',
  'annulé',
  'undo',
  'cancel',
  'solution',
  'répète',
  'repeat',
  ...['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((f) =>
    ['1', '2', '3', '4', '5', '6', '7', '8'].map((r) => f + r),
  ),
];
