/**
 * Material signature + similarity key for endgame pool curation.
 */
import { Chess } from 'chess.js';
import type { EndgameFamily } from './taxonomy.ts';
import type { EndgameTrainingStyle } from './qualityConfig.ts';

export type MaterialCounts = {
  K: number;
  Q: number;
  R: number;
  B: number;
  N: number;
  P: number;
  k: number;
  q: number;
  r: number;
  b: number;
  n: number;
  p: number;
};

export function countMaterial(fen: string): MaterialCounts {
  const board = fen.split(' ')[0]!;
  const c: MaterialCounts = {
    K: 0, Q: 0, R: 0, B: 0, N: 0, P: 0,
    k: 0, q: 0, r: 0, b: 0, n: 0, p: 0,
  };
  for (const ch of board) {
    if (ch in c) c[ch as keyof MaterialCounts] += 1;
  }
  return c;
}

/** Compact signature e.g. "KQ-kq" or "KRP-krp". */
export function materialSignature(fen: string): string {
  const c = countMaterial(fen);
  const white =
    'K' +
    'Q'.repeat(c.Q) +
    'R'.repeat(c.R) +
    'B'.repeat(c.B) +
    'N'.repeat(c.N) +
    'P'.repeat(c.P);
  const black =
    'k' +
    'q'.repeat(c.q) +
    'r'.repeat(c.r) +
    'b'.repeat(c.b) +
    'n'.repeat(c.n) +
    'p'.repeat(c.p);
  return `${white}-${black}`;
}

export function isBareHeavySymmetry(fen: string): boolean {
  const c = countMaterial(fen);
  const noPawns = c.P === 0 && c.p === 0;
  const noMinors = c.B + c.N + c.b + c.n === 0;
  if (!noPawns || !noMinors) return false;
  const qvq = c.Q === 1 && c.q === 1 && c.R === 0 && c.r === 0;
  const rvr = c.R === 1 && c.r === 1 && c.Q === 0 && c.q === 0;
  return qvq || rvr;
}

function pawnStructureKey(fen: string): string {
  const board = new Chess(fen).board();
  const files: string[] = [];
  for (let file = 0; file < 8; file++) {
    let col = '';
    for (let rank = 0; rank < 8; rank++) {
      const p = board[rank]![file];
      if (p?.type === 'p') col += p.color === 'w' ? 'P' : 'p';
    }
    files.push(col || '-');
  }
  return files.join('');
}

function kingZone(fen: string, color: 'w' | 'b'): string {
  const board = new Chess(fen).board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const p = board[rank]![file];
      if (p?.type === 'k' && p.color === color) {
        const f = file < 3 ? 'L' : file > 4 ? 'R' : 'C';
        const r = rank < 3 ? '1' : rank > 4 ? '3' : '2';
        return `${f}${r}`;
      }
    }
  }
  return '??';
}

/**
 * Similarity key — coarser than FEN so near-duplicates share a bucket.
 * Uses material + family + player + style + coarse pawn file occupancy
 * (not exact king squares) to avoid over-collapsing distinct rook endings.
 */
export function similarityKey(input: {
  fen: string;
  family: EndgameFamily;
  playerColor: 'w' | 'b';
  theme?: string;
  trainingStyle?: EndgameTrainingStyle;
}): string {
  const mat = materialSignature(input.fen);
  const pawns = pawnStructureKey(input.fen);
  // Compress pawn files to presence pattern only
  const pawnPattern = pawns.replace(/P+/g, 'P').replace(/p+/g, 'p');
  const style = input.trainingStyle ?? 'practical';
  return [mat, input.family, input.playerColor, style, pawnPattern].join('|');
}
