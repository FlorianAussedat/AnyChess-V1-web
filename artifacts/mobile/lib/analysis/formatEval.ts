/**
 * White-centric eval labels for AnyLyseur.
 * Examples: "+0.00", "+0.85", "-1.42", "M3", "-M2", "#", "-#"
 */

export type WhiteEval = {
  cp: number | null;
  mate: number | null;
  terminalOutcome?: 'white' | 'black' | 'draw';
};

/** A missing score is not equality. Draw, mate, and a real centipawn value are present. */
export function isEvalPresent(value: WhiteEval): boolean {
  if (value.terminalOutcome) return true;
  if (value.mate != null && value.mate !== 0 && Number.isFinite(value.mate)) return true;
  return value.cp != null && Number.isFinite(value.cp);
}

/** Null when the score is absent. Never turns a missing score into "+0.00". */
export function formatAnyLyseurEval(value: WhiteEval): string | null {
  if (!isEvalPresent(value)) return null;
  if (value.terminalOutcome === 'draw') return '+0.00';
  if (value.terminalOutcome === 'white') return '#';
  if (value.terminalOutcome === 'black') return '-#';

  if (value.mate != null && value.mate !== 0) {
    return value.mate > 0 ? `M${value.mate}` : `-M${Math.abs(value.mate)}`;
  }
  const cp = value.cp;
  if (cp == null || !Number.isFinite(cp)) return null;
  const pawns = cp / 100;
  const abs = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${abs}`;
  if (pawns < -0.005) return `-${abs}`;
  return '+0.00';
}

/** Null when the score is absent. Mates sit on the plateau instead of a huge pawn value. */
export function clampEvalForCurve(value: WhiteEval, maxPawns = 8): number | null {
  if (!isEvalPresent(value)) return null;
  if (value.terminalOutcome === 'draw') return 0;
  if (value.terminalOutcome === 'white') return maxPawns;
  if (value.terminalOutcome === 'black') return -maxPawns;
  if (value.mate != null && value.mate !== 0) {
    return value.mate > 0 ? maxPawns : -maxPawns;
  }
  const cp = value.cp;
  if (cp == null || !Number.isFinite(cp)) return null;
  const pawns = cp / 100;
  return Math.max(-maxPawns, Math.min(maxPawns, pawns));
}

export function whiteAdvantageRatio(value: WhiteEval, maxPawns = 5): number | null {
  const v = clampEvalForCurve(value, maxPawns);
  if (v == null) return null;
  return (v + maxPawns) / (2 * maxPawns);
}
