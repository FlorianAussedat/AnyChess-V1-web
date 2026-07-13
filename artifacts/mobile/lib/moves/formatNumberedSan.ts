/** Format a half-move as "5.e3" or "8...Fg7". */
export function formatNumberedSan(ply: number, san: string): string {
  const fullMove = Math.floor(ply / 2) + 1;
  const isWhite = ply % 2 === 0;
  return isWhite ? `${fullMove}.${san}` : `${fullMove}...${san}`;
}
