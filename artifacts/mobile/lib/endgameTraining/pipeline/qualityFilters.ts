/**
 * Engine-backed quality windows + FEN dedupe for the offline pipeline.
 * Reuses defendDraw fen normalize key where possible.
 */
import { normalizeFenKey } from '../../defendDraw/builder/fenUtils.ts';
import type { CandidateEval } from './types.ts';

/** Near-draw initial eval window (|cp| ≤ 50 from defender POV). */
export const NEAR_DRAW_CP_MAX = 50;

/** After the error move, position must be clearly lost for the defender. */
export const AFTER_ERROR_LOST_CP_MAX = -200;

export function isNearDrawEval(evalCp: number): boolean {
  return Math.abs(evalCp) <= NEAR_DRAW_CP_MAX;
}

export function isClearlyLostAfterError(evalResult: CandidateEval): boolean {
  if (evalResult.mateIn != null && evalResult.mateIn < 0) return true;
  return evalResult.scoreCp <= AFTER_ERROR_LOST_CP_MAX;
}

export function meetsMinDefensiveMoves(
  count: number | undefined,
  minRequired: number | undefined,
): boolean {
  if (minRequired == null) return true;
  if (count == null) return false;
  return count >= minRequired;
}

/** Normalize castling/ep (and drop move clocks) for dedupe. */
export function fenSignature(fen: string): string {
  return normalizeFenKey(fen);
}

export class FenDedupeSet {
  private readonly seen = new Set<string>();

  /** Returns true if this FEN is new; false if duplicate. */
  tryAdd(fen: string): boolean {
    const key = fenSignature(fen);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  get size(): number {
    return this.seen.size;
  }
}
