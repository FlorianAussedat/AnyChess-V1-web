/**
 * WDL (win / draw / loss) for Défends la nulle.
 * Tablebase = mathematical truth; Stockfish = pressure / move choice.
 */
export type WdlVerdict = 'win' | 'draw' | 'loss' | 'unknown';

export type WdlSource = 'terminal' | 'tablebase' | 'heuristic' | 'stockfish';

export type WdlProbeResult = {
  /** From the side-to-move perspective. */
  verdict: WdlVerdict;
  source: WdlSource;
  /** Optional numeric WDL (−2…2) when known (Syzygy / Lichess). */
  wdl?: number;
};

/** Player plies required to succeed. */
export const DEFEND_DRAW_TARGET_MOVES = 30;

export function invertVerdict(v: WdlVerdict): WdlVerdict {
  if (v === 'win') return 'loss';
  if (v === 'loss') return 'win';
  return v;
}

/** Map centipawns (side-to-move) to a coarse WDL bucket. */
export function verdictFromCp(cp: number, drawWindowCp = 80): WdlVerdict {
  if (cp > drawWindowCp) return 'win';
  if (cp < -drawWindowCp) return 'loss';
  return 'draw';
}

/**
 * Defensive precision: drawingMoves / legalMoves.
 * Lower = harder (fewer ways to hold).
 */
export function defensivePrecision(drawingMoves: number, legalMoves: number): number {
  if (legalMoves <= 0) return 1;
  return Math.max(0, Math.min(1, drawingMoves / legalMoves));
}
