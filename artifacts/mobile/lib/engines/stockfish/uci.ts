/**
 * Small, pure UCI helpers shared by every platform transport.
 * No engine/worker/DOM dependencies — trivially unit-testable.
 */
import type { StockfishConfig } from './types';
import { recommendedStockfishElo } from '../../difficulty/PlayerDifficultyProfile.ts';

/**
 * Default engine configuration.
 *
 * Strength is sourced from `PlayerDifficultyProfile` (~1800 Chess.com today)
 * via `recommendedStockfishElo`, so a future global level can adjust Classic
 * without hunting hardcoded constants across the UI.
 *
 * `UCI_LimitStrength` is Stockfish's dedicated human-strength model — far more
 * natural than merely capping search depth.
 *
 * `enginePath` points at the lite single-threaded WASM build copied into
 * `public/engine/`. The single-threaded build needs no COOP/COEP headers,
 * runs fully offline, and is still vastly stronger than any human at 1800.
 */
export const DEFAULT_STOCKFISH_CONFIG: StockfishConfig = {
  elo: recommendedStockfishElo(),
  moveTimeMs: 1000,
  enginePath: '/engine/stockfish-18-lite-single.js',
  multiPv: 4,
  varietyMarginCp: 50,
};

/**
 * Stockfish's supported UCI_Elo range; values are clamped to this window.
 *
 * `UCI_Elo` never goes below `MIN_UCI_ELO` (1320). Strength bands that target
 * weaker ratings still call `clampElo(target)` / pass `MIN_UCI_ELO`, and should
 * compensate with higher `multiPv` + `varietyMarginCp` so play still feels weak
 * when the Elo floor is hit (see GameContext / createOpponentEngine).
 */
export const MIN_UCI_ELO = 1320;
export const MAX_UCI_ELO = 3190;

export function clampElo(elo: number): number {
  if (Number.isNaN(elo)) return DEFAULT_STOCKFISH_CONFIG.elo;
  return Math.max(MIN_UCI_ELO, Math.min(MAX_UCI_ELO, Math.round(elo)));
}

export interface UciMove {
  from: string;
  to: string;
  promotion?: string;
}

/**
 * Parse a `bestmove` line, e.g. "bestmove e2e4 ponder e7e5" or
 * "bestmove e7e8q" or "bestmove (none)".
 * Returns null when there is no move (game over / stopped with no result).
 */
export function parseBestMove(line: string): UciMove | null {
  const match = line.match(/^bestmove\s+(\S+)/);
  if (!match) return null;
  const raw = match[1];
  if (raw === '(none)' || raw === 'none' || raw.length < 4) return null;
  return {
    from: raw.slice(0, 2),
    to: raw.slice(2, 4),
    promotion: raw.length > 4 ? raw[4].toLowerCase() : undefined,
  };
}

/**
 * UCI option commands applied once, right after the `uci`/`uciok` handshake:
 *   - pin the engine to a target human strength (UCI_LimitStrength/UCI_Elo);
 *   - request `multiPv` candidate lines so we can vary the chosen move.
 */
export function setupOptionCommands(elo: number, multiPv: number): string[] {
  return [
    'setoption name UCI_LimitStrength value true',
    `setoption name UCI_Elo value ${clampElo(elo)}`,
    `setoption name MultiPV value ${Math.max(1, Math.round(multiPv))}`,
  ];
}

// ── Move-variety selection ──────────────────────────────────────────────────

/** One ranked candidate parsed from a MultiPV `info` line. */
export interface CandidateLine {
  /** 1-based MultiPV rank (1 = engine's best). */
  multipv: number;
  /** Evaluation in centipawns, from the side-to-move's perspective. */
  scoreCp: number;
  /** First move of the line, in UCI form (e.g. "e2e4"). */
  move: string;
}

const MATE_SCORE = 1_000_000;

/**
 * Parse a UCI `info` line, returning its MultiPV rank, score (centipawns, with
 * mates mapped to a large magnitude) and first move — or null if the line has
 * no principal variation yet.
 */
export function parseInfoLine(line: string): CandidateLine | null {
  if (!line.startsWith('info ')) return null;
  const pvMatch = line.match(/\bpv\s+(\S+)/);
  if (!pvMatch) return null;

  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  const multipv = multipvMatch ? parseInt(multipvMatch[1], 10) : 1;

  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  let scoreCp = 0;
  if (scoreMatch) {
    const value = parseInt(scoreMatch[2], 10);
    scoreCp =
      scoreMatch[1] === 'mate'
        ? (value >= 0 ? 1 : -1) * (MATE_SCORE - Math.abs(value))
        : value;
  }

  return { multipv, scoreCp, move: pvMatch[1] };
}

/** Richer info-line parse for defence analysis (mate distance + optional WDL). */
export type InfoScoreSnapshot = {
  scoreCp: number;
  /** Positive = STM mates in N; negative = STM is mated in N. */
  mateIn: number | null;
  depth: number;
  /** Permille WDL for side-to-move when `UCI_ShowWDL` is on. */
  wdl: { win: number; draw: number; loss: number } | null;
  /** First PV move in UCI, if present. */
  pvMove: string | null;
  /** Full principal variation in UCI tokens (may be empty). */
  pv: string[];
  /** 1-based MultiPV rank when present (default 1). */
  multipv: number;
};

/** Extract UCI PV tokens after ` pv ` (remainder of the info line). */
export function parseInfoPvTokens(line: string): string[] {
  const idx = line.search(/\bpv\s+/);
  if (idx < 0) return [];
  const rest = line.slice(idx).replace(/^pv\s+/, '');
  return rest
    .trim()
    .split(/\s+/)
    .filter((tok) => /^[a-h][1-8][a-h][1-8][qrbn]?$/i.test(tok));
}

export function parseInfoScoreSnapshot(line: string): InfoScoreSnapshot | null {
  if (!line.startsWith('info ')) return null;
  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  if (!scoreMatch && !depthMatch) return null;

  let scoreCp = 0;
  let mateIn: number | null = null;
  if (scoreMatch) {
    const value = parseInt(scoreMatch[2]!, 10);
    if (scoreMatch[1] === 'mate') {
      mateIn = value;
      scoreCp = (value >= 0 ? 1 : -1) * (MATE_SCORE - Math.abs(value));
    } else {
      scoreCp = value;
    }
  }

  const wdlMatch = line.match(/\bwdl\s+(\d+)\s+(\d+)\s+(\d+)/);
  const wdl = wdlMatch
    ? {
        win: parseInt(wdlMatch[1]!, 10),
        draw: parseInt(wdlMatch[2]!, 10),
        loss: parseInt(wdlMatch[3]!, 10),
      }
    : null;

  const pv = parseInfoPvTokens(line);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  return {
    scoreCp,
    mateIn,
    depth: depthMatch ? parseInt(depthMatch[1]!, 10) : 0,
    wdl,
    pvMove: pv[0] ?? null,
    pv,
    multipv: multipvMatch ? parseInt(multipvMatch[1]!, 10) : 1,
  };
}

/** Options for a full-strength defence engine (no Elo cap). */
export function fullStrengthAnalysisOptionCommands(multiPv = 1): string[] {
  return [
    'setoption name UCI_LimitStrength value false',
    'setoption name UCI_ShowWDL value true',
    `setoption name MultiPV value ${Math.max(1, Math.round(multiPv))}`,
  ];
}

/**
 * Choose a move among MultiPV candidates to add natural variety.
 *
 * All candidates whose score is within `marginCp` of the best are eligible;
 * each is weighted so moves closer to the best are more likely, but weaker
 * near-best moves still occur. This keeps play reasonable (no blunders beyond
 * the margin) while avoiding always repeating the single top move.
 *
 * Returns the chosen first move in UCI form, or null if there are no
 * candidates (caller should fall back to the plain `bestmove`).
 */
export function chooseVariedMove(
  candidates: CandidateLine[],
  marginCp: number,
  rng: () => number = Math.random,
): string | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => b.scoreCp - a.scoreCp);
  const best = sorted[0].scoreCp;
  const eligible = sorted.filter((c) => c.scoreCp >= best - marginCp);
  if (eligible.length === 1) return eligible[0].move;

  // Weight: closeness to best within the margin, +1 so the worst-eligible move
  // still has a non-zero chance.
  const weights = eligible.map((c) => marginCp - (best - c.scoreCp) + 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = rng() * total;
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r <= 0) return eligible[i].move;
  }
  return eligible[eligible.length - 1].move;
}
