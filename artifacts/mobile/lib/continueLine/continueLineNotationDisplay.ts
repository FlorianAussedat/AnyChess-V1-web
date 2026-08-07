/**
 * Pure UI-state helper for Continue la ligne notation cards.
 * Avoids duplicating the initial reference line before the first correct move.
 */
export type ContinueLineNotationKind = 'start' | 'reached' | 'none';

export type ContinueLineNotationDisplay = {
  kind: ContinueLineNotationKind;
  /** Section heading for the card (French). */
  heading: string | null;
  /** SAN plies to render as numbered rows. */
  sans: string[];
};

/**
 * @param preambleSans reference line shown/dictated before the user continues
 * @param recitedSans correct user (and session) half-moves since startFen
 * @param correctCount authoritative correct half-move count
 */
export function continueLineNotationDisplay(
  preambleSans: readonly string[],
  recitedSans: readonly string[],
  correctCount: number,
): ContinueLineNotationDisplay {
  if (correctCount <= 0) {
    if (preambleSans.length === 0) {
      return { kind: 'none', heading: null, sans: [] };
    }
    return {
      kind: 'start',
      heading: 'Ligne de départ',
      sans: [...preambleSans],
    };
  }
  return {
    kind: 'reached',
    heading: 'Position atteinte',
    sans: [...preambleSans, ...recitedSans],
  };
}
