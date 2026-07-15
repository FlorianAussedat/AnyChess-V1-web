/**
 * Lightweight global difficulty profile.
 *
 * Modes do NOT share one numerical scale. This profile only provides
 * recommended defaults (~1800 Chess.com today). Mode-specific adapters
 * translate it into Stockfish Elo, puzzle rating bands, sequence length, etc.
 *
 * Do not pretend Chess.com Elo ≡ Stockfish UCI Elo ≡ Lichess puzzle rating.
 */
export type PlayerDifficultyProfile = {
  /** Approximate Chess.com-style rating used as the current design target. */
  estimatedChessComElo: number;
};

/** Current product default — do not change without an explicit product decision. */
export const DEFAULT_PLAYER_DIFFICULTY: PlayerDifficultyProfile = {
  estimatedChessComElo: 1800,
};

/**
 * Recommended Stockfish UCI_Elo for Classic / Opening handoff.
 * Today this mirrors the historical hardcoded 1800 default.
 */
export function recommendedStockfishElo(
  profile: PlayerDifficultyProfile = DEFAULT_PLAYER_DIFFICULTY,
): number {
  return profile.estimatedChessComElo;
}

/**
 * Recommended Lichess puzzle rating window for Tactiques.
 * Preserves the existing 1600–2200 pack filter centered on ~1800.
 */
export function recommendedPuzzleRatingRange(
  profile: PlayerDifficultyProfile = DEFAULT_PLAYER_DIFFICULTY,
): { ratingMin: number; ratingMax: number } {
  const center = profile.estimatedChessComElo;
  return {
    ratingMin: Math.max(600, center - 200),
    ratingMax: center + 400,
  };
}

/**
 * Suggested blind-sequence length in full moves (design hint only).
 * Existing Blind UI still owns the concrete selector.
 */
export function recommendedBlindFullMoves(
  profile: PlayerDifficultyProfile = DEFAULT_PLAYER_DIFFICULTY,
): number {
  if (profile.estimatedChessComElo < 1300) return 3;
  if (profile.estimatedChessComElo < 1600) return 4;
  if (profile.estimatedChessComElo < 1900) return 5;
  if (profile.estimatedChessComElo < 2200) return 6;
  return 7;
}
