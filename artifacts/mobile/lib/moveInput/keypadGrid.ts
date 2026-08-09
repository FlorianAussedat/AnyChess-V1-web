/** Fixed 6-column chess keypad geometry. */

export const KEYPAD_COLUMNS = 6;

/**
 * Equal cell width for a 6-column grid.
 * Gaps are between cells only (columns - 1 gaps).
 */
export function keypadCellWidth(
  availableWidth: number,
  gap: number,
  columns: number = KEYPAD_COLUMNS,
): number {
  if (availableWidth <= 0 || columns <= 0) return 0;
  const totalGaps = gap * Math.max(0, columns - 1);
  return (availableWidth - totalGaps) / columns;
}

/**
 * Width of a button that spans `span` columns in the same 6-column grid.
 * Includes the interstitial gaps between those columns.
 */
export function keypadSpanWidth(
  cellWidth: number,
  gap: number,
  span: number,
): number {
  if (span <= 0) return 0;
  if (span === 1) return cellWidth;
  return cellWidth * span + gap * (span - 1);
}
