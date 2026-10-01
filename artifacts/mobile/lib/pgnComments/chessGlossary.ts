/**
 * Chess-term tokens survive machine translation better than raw English
 * piece names. Restore the official French vocabulary after the call.
 */
const TERMS: { pattern: RegExp; fr: string }[] = [
  { pattern: /\bcheckmates?\b/gi, fr: 'mat' },
  { pattern: /\bcastling\b/gi, fr: 'roque' },
  { pattern: /\bknights\b/gi, fr: 'cavaliers' },
  { pattern: /\bknight\b/gi, fr: 'cavalier' },
  { pattern: /\bbishops\b/gi, fr: 'fous' },
  { pattern: /\bbishop\b/gi, fr: 'fou' },
  { pattern: /\brooks\b/gi, fr: 'tours' },
  { pattern: /\brook\b/gi, fr: 'tour' },
  { pattern: /\bqueens\b/gi, fr: 'dames' },
  { pattern: /\bqueen\b/gi, fr: 'dame' },
  { pattern: /\bkings\b/gi, fr: 'rois' },
  { pattern: /\bking\b/gi, fr: 'roi' },
  { pattern: /\bpawns\b/gi, fr: 'pions' },
  { pattern: /\bpawn\b/gi, fr: 'pion' },
  { pattern: /\bpins\b/gi, fr: 'clouages' },
  { pattern: /\bpin\b/gi, fr: 'clouage' },
  { pattern: /\bforks\b/gi, fr: 'fourchettes' },
  { pattern: /\bfork\b/gi, fr: 'fourchette' },
  { pattern: /\bWhite\b/g, fr: 'les Blancs' },
  { pattern: /\bBlack\b/g, fr: 'les Noirs' },
];

export type GlossedComment = {
  masked: string;
  terms: string[];
};

export function protectChessTerms(text: string): GlossedComment {
  const terms: string[] = [];
  let masked = text;
  for (const term of TERMS) {
    masked = masked.replace(term.pattern, () => {
      const idx = terms.length;
      terms.push(term.fr);
      return `__C${idx}__`;
    });
  }
  return { masked, terms };
}

export function restoreChessTerms(masked: string, terms: readonly string[]): string {
  const restored = masked.replace(/__C(\d+)__/g, (_, raw: string) => {
    const idx = Number(raw);
    return terms[idx] ?? '';
  });
  return restored
    .replace(/\bchevaliers\b/gi, 'cavaliers')
    .replace(/\bchevalier\b/gi, 'cavalier');
}
