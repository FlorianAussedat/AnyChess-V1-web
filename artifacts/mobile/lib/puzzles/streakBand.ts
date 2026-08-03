/**
 * Stable streak key from the active rating / piece-count band selection.
 * Visual mode uses rating only; blind combines rating + piece-count.
 */
export function puzzleStreakBandId(
  ratingBandId: string,
  pieceCountBandId: string | null | undefined,
  submode: 'visual' | 'blind' | null,
): string {
  if (submode === 'blind' && pieceCountBandId) {
    return `${ratingBandId}|${pieceCountBandId}`;
  }
  return ratingBandId;
}

export function formatStreakBandLabel(
  bandId: string,
  ratingLabel: (id: string) => string,
  pieceLabel: (id: string) => string,
): string {
  const [ratingId, pieceId] = bandId.split('|');
  if (pieceId) {
    return `${ratingLabel(ratingId)} · ${pieceLabel(pieceId)}`;
  }
  return ratingLabel(ratingId);
}
