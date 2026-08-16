/**
 * WDL (win / draw / loss) abstraction for Défends la nulle.
 * Tablebase-first; Stockfish / heuristic fallbacks are layered by WdlProbe.
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

export const DEFEND_DRAW_TARGET_MOVES = 10;

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
