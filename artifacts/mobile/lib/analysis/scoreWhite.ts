export type StmScore = {
  scoreCp: number;
  mateIn: number | null;
};

export type WhiteScore = {
  evaluation: number | null;
  mate: number | null;
};

export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  const parts = fen.split(/\s+/);
  return parts[1] === 'b' ? 'b' : 'w';
}

export function stmMateToWhite(mateIn: number, stm: 'w' | 'b'): number {
  return stm === 'w' ? mateIn : -mateIn;
}

export function stmCpToWhite(scoreCp: number, stm: 'w' | 'b'): number {
  return stm === 'w' ? scoreCp : -scoreCp;
}

export function toWhiteScore(score: StmScore, fen: string): WhiteScore {
  const stm = sideToMoveFromFen(fen);
  if (score.mateIn != null && score.mateIn !== 0) {
    return { evaluation: null, mate: stmMateToWhite(score.mateIn, stm) };
  }
  return { evaluation: stmCpToWhite(score.scoreCp, stm), mate: null };
}
