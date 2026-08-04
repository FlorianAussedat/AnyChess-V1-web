/**
 * Heuristic: only treat voice noise as a failed move attempt when it looks
 * like chess vocabulary. Shared by Classic and Openings play loops.
 */
export function looksLikeChessMove(normalized: string): boolean {
  if (/\b[a-h][1-8]\b/.test(normalized)) return true;
  if (
    /\b(pion|cavalier|fou|tour|dame|roi|pawn|knight|bishop|rook|queen|king|roque|castle|petit|grand)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  if (/\bprend|takes|captures\b/.test(normalized)) return true;
  return false;
}
