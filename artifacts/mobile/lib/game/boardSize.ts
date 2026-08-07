/**
 * Shared chessboard footprint sizing.
 *
 * Modes:
 * - `default` — historical compact board (capped), used by most modes
 * - `wide` — ~94–96% of screen width with small side margins (square)
 *
 * Screens opt in via `sizeMode` on ChessBoard / related wrappers.
 * Do not hardcode per-screen pixel widths.
 */
export type BoardSizeMode = 'default' | 'wide';

/** Historical compact board max edge (default mode). */
export const DEFAULT_BOARD_MAX_SIZE = 352;

/** Minimum wide/default edge so tiny windows stay usable. */
export const MIN_BOARD_SIZE = 240;

/**
 * Compute a square board edge length for the given screen width and mode.
 */
export function computeBoardSize(
  screenWidth: number,
  mode: BoardSizeMode = 'default',
): number {
  const w = Math.max(0, screenWidth);
  if (mode === 'wide') {
    // ~2.5% inset each side → ~95% of screen; never below 8px inset.
    const inset = Math.max(8, Math.round(w * 0.025));
    return Math.max(MIN_BOARD_SIZE, w - 2 * inset);
  }
  return Math.min(Math.max(0, w - 20), DEFAULT_BOARD_MAX_SIZE);
}
