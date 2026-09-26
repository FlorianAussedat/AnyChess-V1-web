/**
 * Small, pure UCI helpers shared by every platform transport.
 * No engine/worker/DOM dependencies — trivially unit-testable.
 */
import type { StockfishConfig } from './types';
import { recommendedStockfishElo } from '../../difficulty/PlayerDifficultyProfile.ts';

/**
 * Nominal UCI_Elo window advertised by Stockfish 18 (web WASM) and
 * Stockfish 19 (Android). `observeUciOptionLine` replaces this with the
 * bounds the running binary actually prints, when they differ.
 */
export const MIN_UCI_ELO = 1320;
export const MAX_UCI_ELO = 3190;

/**
 * Cubic used by SF18 and SF19 to turn `UCI_Elo` into an internal skill level
 * (`search.h`, Skill). Skill 0..19 covers CCRL Blitz ~1320..3190.
 * Fitted on the nominal window above — not on a rescaled product Elo.
 */
const SKILL_ELO_SPAN = MAX_UCI_ELO - MIN_UCI_ELO;

let reportedEloMin = MIN_UCI_ELO;
let reportedEloMax = MAX_UCI_ELO;

/** Extra MultiPV / variety only when the requested Elo is below the engine floor. */
export const FLOOR_STRENGTH_MULTIPV = 8;
export const FLOOR_STRENGTH_VARIETY_MARGIN_CP = 120;
/**
 * Think time for below-floor opponents. Strength there is the variety window,
 * so this is a real search — not a depth cap and not a few dozen milliseconds.
 */
export const FLOOR_VARIETY_MOVETIME_MS = 600;

export interface UciEloBounds {
  defaultValue: number;
  min: number;
  max: number;
}

/**
 * Parse `option name UCI_Elo type spin default D min A max B` from `uci`.
 * Returns null for every other line.
 */
export function parseUciEloBounds(line: string): UciEloBounds | null {
  const match = line.match(
    /^option name UCI_Elo type spin default (\d+) min (\d+) max (\d+)\s*$/,
  );
  if (!match) return null;
  return {
    defaultValue: Number(match[1]),
    min: Number(match[2]),
    max: Number(match[3]),
  };
}

/** Remember the bounds printed by the live engine. */
export function observeUciOptionLine(line: string): void {
  const bounds = parseUciEloBounds(line);
  if (!bounds || bounds.min <= 0 || bounds.max < bounds.min) return;
  reportedEloMin = bounds.min;
  reportedEloMax = bounds.max;
}

/** Test isolation. Production boot calls `observeUciOptionLine` instead. */
export function resetUciEloBounds(): void {
  reportedEloMin = MIN_UCI_ELO;
  reportedEloMax = MAX_UCI_ELO;
}

export function currentUciEloBounds(): { min: number; max: number } {
  return { min: reportedEloMin, max: reportedEloMax };
}

/**
 * Default engine configuration.
 *
 * Strength is sourced from `PlayerDifficultyProfile` (~1800 Chess.com today)
 * via `recommendedStockfishElo`, so a future global level can adjust Classic
 * without hunting hardcoded constants across the UI.
 *
 * Above the UCI floor, strength is only `UCI_LimitStrength` + `UCI_Elo`.
 * MultiPV stays 1 so we play Stockfish's own bestmove. A client-side
 * variety pick on top of that was a second, uncalibrated weakening.
 *
 * `enginePath` points at the lite single-threaded WASM build copied into
 * `public/engine/`. The single-threaded build needs no COOP/COEP headers
 * and runs fully offline.
 */
export const DEFAULT_STOCKFISH_CONFIG: StockfishConfig = {
  elo: recommendedStockfishElo(),
  moveTimeMs: 600,
  enginePath: '/engine/stockfish-18-lite-single.js',
  multiPv: 1,
  varietyMarginCp: 0,
};

export function clampElo(elo: number): number {
  if (Number.isNaN(elo)) return DEFAULT_STOCKFISH_CONFIG.elo;
  return Math.max(reportedEloMin, Math.min(reportedEloMax, Math.round(elo)));
}

/**
 * Internal skill level SF18/SF19 will derive from this Elo.
 * Used only to size the search so it reaches `time_to_pick`, not as a
 * second strength knob (we never send `Skill Level`).
 */
export function stockfishSkillLevelForElo(elo: number): number {
  const clamped = clampElo(elo);
  const e = (clamped - MIN_UCI_ELO) / SKILL_ELO_SPAN;
  const level = ((37.2473 * e - 40.8525) * e + 22.2943) * e - 0.311438;
  if (Number.isNaN(level)) return 0;
  return Math.min(19, Math.max(0, level));
}

export interface HumanEloSearchLimit {
  /** Depth at which Stockfish freezes the handicapped move (`1 + floor(skill)`). */
  pickDepth: number;
  /**
   * Stop two plies after the pick. Deeper search does not change the move
   * once skill has chosen it, and a shallower cap would pick on noisy scores.
   */
  depth: number;
  movetimeMs: number;
}

/**
 * Response-time budget for a human-Elo game search.
 * Strength stays `UCI_Elo`. Depth/movetime only stop the search once the
 * engine has reached the depth where it decides the handicapped move.
 */
export function humanEloSearchLimit(elo: number): HumanEloSearchLimit {
  const pickDepth = 1 + Math.floor(stockfishSkillLevelForElo(elo));
  const depth = pickDepth + 2;
  const movetimeMs = Math.min(900, Math.max(500, 280 + pickDepth * 80));
  return { pickDepth, depth, movetimeMs };
}

export interface GameEngineProfile {
  elo: number;
  multiPv: number;
  varietyMarginCp: number;
  moveTimeMs: number;
}

/**
 * Classic / Opening play profile for a requested band centre.
 *
 * At or above the floor: `UCI_Elo` is the only strength limit (MultiPV 1,
 * no variety). Below the floor Stockfish cannot go weaker, so the existing
 * variety window remains — that is the documented exception, not a second
 * cap on a 2000 opponent.
 */
export function gameEngineProfile(targetElo: number): GameEngineProfile {
  if (targetElo < MIN_UCI_ELO) {
    return {
      elo: MIN_UCI_ELO,
      multiPv: FLOOR_STRENGTH_MULTIPV,
      varietyMarginCp: FLOOR_STRENGTH_VARIETY_MARGIN_CP,
      moveTimeMs: FLOOR_VARIETY_MOVETIME_MS,
    };
  }
  const elo = clampElo(targetElo);
  return {
    elo,
    multiPv: 1,
    varietyMarginCp: 0,
    moveTimeMs: humanEloSearchLimit(elo).movetimeMs,
  };
}

export function uciPlayOptionsForTargetElo(targetElo: number): GameEngineProfile {
  return gameEngineProfile(targetElo);
}

/**
 * `go` for a game profile.
 * Human Elo: `depth` is just past the skill pick, `movetime` is the phone cap.
 * Below-floor variety: movetime only, so depth is not an extra strength cap.
 */
export function gameGoCommand(profile: Pick<GameEngineProfile, 'elo' | 'multiPv'>): string {
  if (profile.multiPv > 1) {
    return `go movetime ${FLOOR_VARIETY_MOVETIME_MS}`;
  }
  const limit = humanEloSearchLimit(profile.elo);
  return `go depth ${limit.depth} movetime ${limit.movetimeMs}`;
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
 * Game-engine options, sent after `uciok` and again when the level changes.
 * `UCI_LimitStrength` + `UCI_Elo` are the strength model. `Skill Level` is
 * intentionally absent: with LimitStrength on, Stockfish derives skill from
 * `UCI_Elo` and a second Skill Level would be ignored or would fight it.
 * MultiPV is 1 for human Elos (play `bestmove`) and higher only below the floor.
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
