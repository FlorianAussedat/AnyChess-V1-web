/**
 * Safe FEN transforms for theoretical endgame variants.
 * Only use when chess.js validates the result and ep/castling remain legal.
 */
import { Chess } from 'chess.js';

function swapPieceCase(ch: string): string {
  if (ch >= 'A' && ch <= 'Z') return ch.toLowerCase();
  if (ch >= 'a' && ch <= 'z') return ch.toUpperCase();
  return ch;
}

function swapCastlingRights(castling: string): string {
  if (castling === '-') return '-';
  return castling
    .split('')
    .map((c) => {
      if (c === 'K') return 'k';
      if (c === 'Q') return 'q';
      if (c === 'k') return 'K';
      if (c === 'q') return 'Q';
      return c;
    })
    .join('');
}

function mirrorEpFile(ep: string): string {
  if (ep === '-') return '-';
  const file = ep[0]!;
  const rank = ep[1]!;
  const files = 'abcdefgh';
  const idx = files.indexOf(file);
  if (idx < 0) return ep;
  return `${files[7 - idx]}${rank}`;
}

/** Vertical flip + color swap (play the same position as the opposite side). */
export function flipColors(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error('Invalid FEN');
  const [board, stm, castling, ep, halfmove = '0', fullmove = '1'] = parts;
  if (ep !== '-') {
    throw new Error('flipColors: en passant must be absent');
  }

  const flippedBoard = board
    .split('/')
    .reverse()
    .map((rank) =>
      rank
        .split('')
        .map((ch) => swapPieceCase(ch))
        .join(''),
    )
    .join('/');

  const next = [
    flippedBoard,
    stm === 'w' ? 'b' : 'w',
    swapCastlingRights(castling ?? '-'),
    '-',
    halfmove,
    fullmove,
  ].join(' ');

  new Chess(next);
  return next;
}

/** Mirror ranks horizontally (a-file ↔ h-file). */
export function mirrorHorizontal(fen: string): string {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) throw new Error('Invalid FEN');
  const [board, stm, castling, ep, halfmove = '0', fullmove = '1'] = parts;

  const mirroredBoard = board
    .split('/')
    .map((rank) =>
      rank
        .split('')
        .reverse()
        .join(''),
    )
    .join('/');

  const next = [
    mirroredBoard,
    stm,
    castling,
    mirrorEpFile(ep ?? '-'),
    halfmove,
    fullmove,
  ].join(' ');

  new Chess(next);
  return next;
}

export function isTransformSafe(fen: string): boolean {
  const parts = fen.trim().split(/\s+/);
  if (parts.length < 4) return false;
  if (parts[3] !== '-') return false;
  try {
    new Chess(fen);
    return true;
  } catch {
    return false;
  }
}
