/**
 * Format discrete position reference for display / copy.
 */
export type PositionRefInput = {
  id: string;
  sourceId?: string;
  provider?: string;
};

export function formatPositionReference(input: PositionRefInput): string {
  const ref = input.id.startsWith('Réf.') ? input.id : `Réf. ${input.id}`;
  if (input.sourceId && input.provider?.includes('lichess')) {
    return `${ref} · Lichess ${input.sourceId}`;
  }
  return ref;
}

/** Copy-friendly plain reference (without Réf. prefix duplication). */
export function copyablePositionReference(input: PositionRefInput): string {
  return formatPositionReference(input);
}
