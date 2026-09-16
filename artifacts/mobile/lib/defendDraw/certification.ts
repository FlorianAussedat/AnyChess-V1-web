/**
 * Authoring-time draw certification metadata for Défends la nulle.
 * Runtime never runs Syzygy/Stockfish to (re)certify — it only reads these fields.
 */

export type DefendDrawVerificationMethod = 'syzygy' | 'stockfish';

export type DefendDrawVerification = {
  method: DefendDrawVerificationMethod;
  /** Exact theoretical / engine outcome for the starting FEN (STM perspective). */
  result: 'draw';
  /** Present when method === 'stockfish'. */
  engine?: string;
  /** Search depth used for stockfish certification. */
  depth?: number;
  /**
   * Optional absolute centipawn bound used when certifying with Stockfish
   * (documentation only — not a runtime threshold).
   */
  maxAbsCp?: number;
};

/** Max pieces for which Syzygy (via Lichess tablebase API) can certify. */
export const SYZYGY_MAX_PIECES = 7;

/** Stockfish certification defaults (authoring script). */
export const STOCKFISH_CERT_MIN_DEPTH = 22;
export const STOCKFISH_CERT_MAX_ABS_CP = 35;
export const STOCKFISH_CERT_ENGINE_LABEL = 'Stockfish 18';

/**
 * `verifiedDraw: true` alone is insufficient — certification must prove draw.
 */
export function hasProvenDrawCertification(
  verification: DefendDrawVerification | null | undefined,
): boolean {
  if (!verification) return false;
  if (verification.result !== 'draw') return false;
  if (verification.method === 'syzygy') return true;
  if (verification.method === 'stockfish') {
    return (
      typeof verification.depth === 'number' &&
      verification.depth >= STOCKFISH_CERT_MIN_DEPTH &&
      typeof verification.engine === 'string' &&
      verification.engine.length > 0
    );
  }
  return false;
}

export function isAcceptableVerifiedDrawFlag(
  verifiedDraw: unknown,
  verification: DefendDrawVerification | null | undefined,
): boolean {
  return verifiedDraw === true && hasProvenDrawCertification(verification);
}
