/**
 * Think-time config for Défends la nulle — strong Stockfish, fluent UX.
 * Difficulty mainly comes from the position; time only nudges search length.
 */
import type { AnyChessDifficultyId } from '../difficulty/anyChessDifficulty.ts';

export const DEFEND_DRAW_ENGINE_CONFIG = {
  /** Fallback when difficulty is unknown. */
  moveTimeMs: 1000,
  /** Safety ceiling so the UI never hangs on "Stockfish réfléchit…". */
  analysisTimeoutMs: 12_000,
  bootTimeoutMs: 30_000,
  byDifficulty: {
    debutant: 400,
    confirme: 700,
    expert: 1000,
    grandMaitre: 1500,
  } satisfies Record<AnyChessDifficultyId, number>,
} as const;

export function defendDrawMoveTimeMs(
  difficulty: AnyChessDifficultyId,
): number {
  return (
    DEFEND_DRAW_ENGINE_CONFIG.byDifficulty[difficulty] ??
    DEFEND_DRAW_ENGINE_CONFIG.moveTimeMs
  );
}
