/**
 * Endgame family + tag inference for pool candidates.
 */
import { countMaterial } from '../../../defendDraw/materialSignature.ts';
import type { EndgameFamilyKind } from './types.ts';

export function inferEndgameFamily(fen: string): EndgameFamilyKind {
  const c = countMaterial(fen);
  const queens = c.Q + c.q;
  const rooks = c.R + c.r;
  const minors = c.B + c.b + c.N + c.n;
  const pawns = c.P + c.p;

  const hasQueen = queens > 0;
  const hasRook = rooks > 0;
  const hasMinor = minors > 0;
  const hasPawn = pawns > 0;

  const kinds =
    (hasQueen ? 1 : 0) + (hasRook ? 1 : 0) + (hasMinor ? 1 : 0) + (hasPawn ? 1 : 0);

  if (kinds >= 3) return 'mixed';
  if (hasQueen && hasRook) return 'mixed';
  if (hasQueen && hasMinor) return 'mixed';
  if (hasRook && hasMinor) return 'rook-and-minor';
  if (hasQueen) return 'queen';
  if (hasRook) return 'rook';
  if (hasMinor) return 'minor-piece';
  if (hasPawn) return 'pawn';
  return 'pawn';
}

const THEME_TAG_MAP: Record<string, string> = {
  pawnEndgame: 'pawn',
  rookEndgame: 'rook',
  bishopEndgame: 'minor-piece',
  knightEndgame: 'minor-piece',
  queenEndgame: 'queen',
  oppositeBishops: 'opposite-bishops',
  bishopPair: 'same-color-bishops',
  promotion: 'promotion-race',
  defensiveMove: 'defensive-sacrifice',
  fortress: 'fortress',
  zugzwang: 'blockade',
  advancedPawn: 'passed-pawn',
  passedPawn: 'passed-pawn',
  backRankMate: 'perpetual-threat',
};

export function inferTags(fen: string, themes: string[]): string[] {
  const tags = new Set<string>();
  for (const theme of themes) {
    const mapped = THEME_TAG_MAP[theme];
    if (mapped) tags.add(mapped);
  }

  const c = countMaterial(fen);
  const total =
    c.Q + c.q + c.R + c.r + c.B + c.b + c.N + c.n + c.P + c.p;
  if (total <= 7) tags.add('syzygy-eligible');

  const white = c.Q + c.R + c.B + c.N + c.P;
  const black = c.q + c.r + c.b + c.n + c.p;
  if (Math.abs(white - black) >= 2) tags.add('material-imbalance');

  return [...tags];
}

export function pieceCountFromFen(fen: string): number {
  const c = countMaterial(fen);
  return c.Q + c.q + c.R + c.r + c.B + c.b + c.N + c.n + c.P + c.p + 2;
}
