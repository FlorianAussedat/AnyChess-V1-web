/**
 * Geometry helpers for CHOIX DU CAMP zone highlights (pre-game only).
 * Ranks 1–2 = White starting pieces; ranks 7–8 = Black starting pieces.
 */
export type CampZoneRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Absolute rects for White/Black piece bands on a square board of `boardSize`.
 * When `isFlipped`, White is visually at the top.
 */
export function campZoneRects(
  boardSize: number,
  isFlipped = false,
): { white: CampZoneRect; black: CampZoneRect } {
  const band = (boardSize / 8) * 2;
  const full: Omit<CampZoneRect, 'top'> = { left: 0, width: boardSize, height: band };
  if (!isFlipped) {
    return {
      white: { ...full, top: boardSize - band },
      black: { ...full, top: 0 },
    };
  }
  return {
    white: { ...full, top: 0 },
    black: { ...full, top: boardSize - band },
  };
}
