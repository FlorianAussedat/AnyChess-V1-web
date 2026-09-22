/** Convert PGN NAGs / glyphs to a short readable label. */
const NAG_LABELS: Record<string, string> = {
  $1: '!',
  $2: '?',
  $3: '!!',
  $4: '??',
  $5: '!?',
  $6: '?!',
  $7: '□',
  $8: '□',
  $10: '=',
  $13: '∞',
  $14: '⩲',
  $15: '⩱',
  $16: '±',
  $17: '∓',
  $18: '+−',
  $19: '−+',
};

export function nagLabel(nag: string): string {
  const key = nag.startsWith('$') ? nag : `$${nag}`;
  return NAG_LABELS[key] ?? nag;
}

export function formatNags(nags: readonly string[] | undefined): string {
  if (!nags || nags.length === 0) return '';
  return nags.map(nagLabel).join('');
}

/** Common pedagogical glyphs offered in the visual PGN editor. */
export const EDITOR_NAG_CHOICES: { nag: string; glyph: string }[] = [
  { nag: '$1', glyph: '!' },
  { nag: '$2', glyph: '?' },
  { nag: '$3', glyph: '!!' },
  { nag: '$4', glyph: '??' },
  { nag: '$5', glyph: '!?' },
  { nag: '$6', glyph: '?!' },
];
