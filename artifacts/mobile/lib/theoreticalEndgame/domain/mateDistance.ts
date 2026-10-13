/**
 * Mate distance used to grade one user decision.
 *
 * UCI `score mate N` counts moves of the mating side, not plies. A positive
 * N means the side to move mates in N moves (2N−1 plies). A negative N means
 * that side is mated in |N| moves (2|N| plies). A centipawn score is never
 * converted into a distance.
 */
export function uciMateToPlies(mateIn: number): number {
  const moves = Math.abs(mateIn);
  return mateIn > 0 ? moves * 2 - 1 : moves * 2;
}

/** Distance after the user has moved, opponent to move. 0 is checkmate. */
export function dtmAfterUserMove(mateIn: number | null, userJustMated = false): number | null {
  if (userJustMated) return 0;
  if (mateIn == null || !Number.isInteger(mateIn) || mateIn >= 0) return null;
  return uciMateToPlies(mateIn);
}

/** Distance when it is the user's turn and the engine announces a mate for them. */
export function dtmOnUserTurn(mateIn: number | null): number | null {
  if (mateIn == null || !Number.isInteger(mateIn) || mateIn <= 0) return null;
  return uciMateToPlies(mateIn);
}

/**
 * Plies wasted by one user move.
 * A perfect move leaves dtmAfter = dtmBefore - 1. Anything longer is waste.
 * A shorter mate is not waste. The opponent's later reply is not an input.
 */
export function wastedPlies(dtmBefore: number, dtmAfter: number): number {
  return Math.max(0, dtmAfter - (dtmBefore - 1));
}
