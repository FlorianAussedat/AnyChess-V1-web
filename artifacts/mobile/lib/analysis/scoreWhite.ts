/**
 * White-centric score mapping from Stockfish STM scores.
 *
 * mateIn conventions (STM):
 * - positive N: STM mates in N
 * - negative N: STM is mated in N
 * - 0: STM is already checkmated (terminal)
 *
 * White-centric output:
 * - positive mate / cp: White advantage
 * - negative: Black advantage
 * Board flip never changes the sign.
 */
import { Chess } from 'chess.js';

export type StmScore = {
  scoreCp: number;
  mateIn: number | null;
};

export type WhiteScore = {
  evaluation: number | null;
  mate: number | null;
  /** Terminal game result when position is already over. */
  terminalOutcome?: 'white' | 'black' | 'draw';
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

/**
 * Map STM score to White-centric. Handles mate 0 (already checkmated STM).
 */
export function toWhiteScore(score: StmScore, fen: string): WhiteScore {
  const stm = sideToMoveFromFen(fen);

  if (score.mateIn != null) {
    if (score.mateIn === 0) {
      // STM is already mated.
      return {
        evaluation: null,
        mate: stm === 'w' ? -1 : 1,
        terminalOutcome: stm === 'w' ? 'black' : 'white',
      };
    }
    return {
      evaluation: null,
      mate: stmMateToWhite(score.mateIn, stm),
    };
  }

  return { evaluation: stmCpToWhite(score.scoreCp, stm), mate: null };
}

/** Detect terminal positions without relying on the engine. */
export function terminalWhiteScoreFromFen(fen: string): WhiteScore | null {
  try {
    const chess = new Chess(fen);
    if (chess.isCheckmate()) {
      const stm = sideToMoveFromFen(fen);
      return {
        evaluation: null,
        mate: stm === 'w' ? -1 : 1,
        terminalOutcome: stm === 'w' ? 'black' : 'white',
      };
    }
    if (
      chess.isStalemate() ||
      chess.isThreefoldRepetition() ||
      chess.isInsufficientMaterial() ||
      chess.isDraw()
    ) {
      return { evaluation: 0, mate: null, terminalOutcome: 'draw' };
    }
  } catch {
    return null;
  }
  return null;
}
