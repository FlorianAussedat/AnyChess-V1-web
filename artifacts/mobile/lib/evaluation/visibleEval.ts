/**
 * Universal visible evaluation helpers (−10.00 … +10.00 pawns, mate notation).
 * Internal raw centipawns may exceed the visible band; UI must use these helpers.
 */

export type EvalPerspective = 'white' | 'black';

export type VisibleEvalInput = {
  /** Raw centipawns from engine (STM-centric or already normalized — see perspective). */
  scoreCp: number;
  mateIn?: number | null;
  /** Whose advantage positive values represent. Required — never infer from turn alone. */
  perspective: EvalPerspective;
  /** When true, scoreCp is already from perspective POV. When false, invert if STM !== perspective. */
  scoreIsPerspectivePov?: boolean;
  sideToMove?: 'w' | 'b';
};

export type VisibleEval = {
  /** Clamped player-perspective centipawns used for gauge fill (−1000 … +1000). */
  visibleCp: number;
  /** Display pawns (−10.00 … +10.00) unless mate label applies. */
  visiblePawns: number;
  /** Mate label e.g. M17, −M2 — null when numeric display applies. */
  mateLabel: string | null;
  /** Raw perspective cp (unclamped) for decisions — never use visibleCp for loss threshold. */
  rawPerspectiveCp: number;
  mateIn: number | null;
};

export const VISIBLE_CP_MIN = -1000;
export const VISIBLE_CP_MAX = 1000;

export function perspectiveToSide(p: EvalPerspective): 'w' | 'b' {
  return p === 'white' ? 'w' : 'b';
}

/** Normalize engine score to explicit perspective POV. */
export function toPerspectiveCp(input: VisibleEvalInput): {
  scoreCp: number;
  mateIn: number | null;
} {
  const { scoreCp, mateIn = null, perspective, scoreIsPerspectivePov, sideToMove } =
    input;
  if (scoreIsPerspectivePov || !sideToMove) {
    return { scoreCp, mateIn };
  }
  const same = sideToMove === perspectiveToSide(perspective);
  if (mateIn != null) {
    const m = same ? mateIn : -mateIn;
    const cp =
      m > 0 ? 100_000 - Math.abs(m) : m < 0 ? -(100_000 - Math.abs(m)) : 0;
    return { scoreCp: cp, mateIn: m };
  }
  return { scoreCp: same ? scoreCp : -scoreCp, mateIn: null };
}

/** Format mate from perspective: M17 = perspective can mate; −M17 = perspective is mated. */
export function formatMateLabel(mateIn: number): string {
  if (mateIn === 0) return '0.00';
  if (mateIn > 0) return `M${mateIn}`;
  return `−M${Math.abs(mateIn)}`;
}

export function clampVisibleCp(cp: number): number {
  return Math.max(VISIBLE_CP_MIN, Math.min(VISIBLE_CP_MAX, cp));
}

export function visiblePawnsFromCp(visibleCp: number): number {
  return visibleCp / 100;
}

/** Format numeric pawns with sign and two decimals (French minus sign). */
export function formatVisiblePawns(pawns: number): string {
  const abs = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${abs}`;
  if (pawns < -0.005) return `−${abs}`;
  return '0.00';
}

export function computeVisibleEval(input: VisibleEvalInput): VisibleEval {
  const { scoreCp, mateIn } = toPerspectiveCp(input);
  const rawPerspectiveCp = scoreCp;

  if (mateIn != null && mateIn !== 0) {
    return {
      visibleCp: clampVisibleCp(rawPerspectiveCp),
      visiblePawns: visiblePawnsFromCp(clampVisibleCp(rawPerspectiveCp)),
      mateLabel: formatMateLabel(mateIn),
      rawPerspectiveCp,
      mateIn,
    };
  }

  const visibleCp = clampVisibleCp(rawPerspectiveCp);
  return {
    visibleCp,
    visiblePawns: visiblePawnsFromCp(visibleCp),
    mateLabel: null,
    rawPerspectiveCp,
    mateIn: null,
  };
}

/** Gauge fill ratio 0…1 for a band [minCp, maxCp] (higher = better for player). */
export function gaugeFillRatioForBand(
  scoreCp: number,
  minCp: number,
  maxCp: number,
): number {
  const clamped = Math.max(minCp, Math.min(maxCp, scoreCp));
  if (maxCp === minCp) return 1;
  return (clamped - minCp) / (maxCp - minCp);
}
