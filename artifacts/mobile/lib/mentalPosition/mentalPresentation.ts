/**
 * Pure helpers for Suivi mental setup / presentation options.
 */

export const MENTAL_FULL_MOVES_MIN = 2;
export const MENTAL_FULL_MOVES_MAX = 20;

export function clampMentalFullMoves(n: number): number {
  return Math.max(
    MENTAL_FULL_MOVES_MIN,
    Math.min(MENTAL_FULL_MOVES_MAX, Math.round(n)),
  );
}

/** 1 full move = White + Black. */
export function mentalHalfMoveCount(fullMoves: number): number {
  return clampMentalFullMoves(fullMoves) * 2;
}

export type MentalPresentationFlags = {
  dictate: boolean;
  showBoard: boolean;
};

/**
 * Toggle dictate or board display, refusing a transition that would leave both OFF.
 * Returns the next flags, or `null` if the toggle must be blocked.
 */
export function toggleMentalPresentation(
  current: MentalPresentationFlags,
  which: keyof MentalPresentationFlags,
): MentalPresentationFlags | null {
  const next = { ...current, [which]: !current[which] };
  if (!next.dictate && !next.showBoard) return null;
  return next;
}

/** Exactly 19 discrete integer stops from 2…20. */
export function mentalFullMoveStops(): number[] {
  const out: number[] = [];
  for (let n = MENTAL_FULL_MOVES_MIN; n <= MENTAL_FULL_MOVES_MAX; n++) out.push(n);
  return out;
}
