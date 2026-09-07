/**
 * White-centric eval labels for AnyLyseur.
 * Examples: "+0.00", "+0.85", "-1.42", "M3", "-M2", "#", "-#"
 */

export type WhiteEval = {
  cp: number | null;
  mate: number | null;
  terminalOutcome?: 'white' | 'black' | 'draw';
};

export function formatAnyLyseurEval(value: WhiteEval): string {
  if (value.terminalOutcome === 'draw') return '+0.00';
  if (value.terminalOutcome === 'white') return '#';
  if (value.terminalOutcome === 'black') return '-#';

  if (value.mate != null && value.mate !== 0) {
    return value.mate > 0 ? `M${value.mate}` : `-M${Math.abs(value.mate)}`;
  }
  const cp = value.cp ?? 0;
  const pawns = cp / 100;
  const abs = Math.abs(pawns).toFixed(2);
  if (pawns > 0.005) return `+${abs}`;
  if (pawns < -0.005) return `-${abs}`;
  return '+0.00';
}

export function clampEvalForCurve(value: WhiteEval, maxPawns = 8): number {
  if (value.terminalOutcome === 'draw') return 0;
  if (value.terminalOutcome === 'white') return maxPawns;
  if (value.terminalOutcome === 'black') return -maxPawns;
  if (value.mate != null && value.mate !== 0) {
    return value.mate > 0 ? maxPawns : -maxPawns;
  }
  const pawns = (value.cp ?? 0) / 100;
  return Math.max(-maxPawns, Math.min(maxPawns, pawns));
}

export function whiteAdvantageRatio(value: WhiteEval, maxPawns = 5): number {
  const v = clampEvalForCurve(value, maxPawns);
  return (v + maxPawns) / (2 * maxPawns);
}
