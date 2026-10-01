/**
 * Keep PGN structure out of DeepL: directives, FEN and SAN stay verbatim.
 * Chess vocabulary is swapped to French before the call so DeepL does not
 * invent "chevalier" / "roi blanc".
 */

const DIRECTIVE_RE = /\[%[^\]]+\]/g;
const FEN_RE =
  /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?: [wb] [KQkq-]+ [a-h1-8-] \d+ \d+)?\b/g;
const SAN_RE =
  /\b(?:[NBRQK][a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|[a-h]x?[a-h]?[1-8](?:=[NBRQ])?[+#]?|O-O-O|O-O)\b/g;

const TERMS: { pattern: RegExp; fr: string }[] = [
  { pattern: /\bcheckmates?\b/gi, fr: "mat" },
  { pattern: /\bcastling\b/gi, fr: "roque" },
  { pattern: /\bknights\b/gi, fr: "cavaliers" },
  { pattern: /\bknight\b/gi, fr: "cavalier" },
  { pattern: /\bbishops\b/gi, fr: "fous" },
  { pattern: /\bbishop\b/gi, fr: "fou" },
  { pattern: /\brooks\b/gi, fr: "tours" },
  { pattern: /\brook\b/gi, fr: "tour" },
  { pattern: /\bqueens\b/gi, fr: "dames" },
  { pattern: /\bqueen\b/gi, fr: "dame" },
  { pattern: /\bkings\b/gi, fr: "rois" },
  { pattern: /\bking\b/gi, fr: "roi" },
  { pattern: /\bpawns\b/gi, fr: "pions" },
  { pattern: /\bpawn\b/gi, fr: "pion" },
  { pattern: /\bpins\b/gi, fr: "clouages" },
  { pattern: /\bpin\b/gi, fr: "clouage" },
  { pattern: /\bforks\b/gi, fr: "fourchettes" },
  { pattern: /\bfork\b/gi, fr: "fourchette" },
  { pattern: /\bWhite\b/g, fr: "les Blancs" },
  { pattern: /\bBlack\b/g, fr: "les Noirs" },
];

export type ProtectedPgnComment = {
  masked: string;
  tokens: string[];
};

export function glossChessTerms(text: string): string {
  let out = text;
  for (const term of TERMS) {
    out = out.replace(term.pattern, term.fr);
  }
  return out
    .replace(/\bchevaliers\b/gi, "cavaliers")
    .replace(/\bchevalier\b/gi, "cavalier");
}

export function protectPgnComment(text: string): ProtectedPgnComment {
  const tokens: string[] = [];
  const mask = (match: string) => {
    const idx = tokens.length;
    tokens.push(match);
    return `<x i="${idx}"/>`;
  };
  let masked = text.replace(DIRECTIVE_RE, mask);
  masked = masked.replace(FEN_RE, mask);
  masked = masked.replace(SAN_RE, mask);
  return { masked: glossChessTerms(masked), tokens };
}

export function restorePgnComment(
  masked: string,
  tokens: readonly string[],
): string {
  return masked
    .replace(/<x i="(\d+)"\s*\/>/g, (_, raw: string) => {
      const idx = Number(raw);
      return tokens[idx] ?? "";
    })
    .replace(/\bchevaliers\b/gi, "cavaliers")
    .replace(/\bchevalier\b/gi, "cavalier");
}

export function directivesUnchanged(
  original: string,
  translated: string,
): boolean {
  const a = original.match(DIRECTIVE_RE) ?? [];
  const b = translated.match(DIRECTIVE_RE) ?? [];
  if (a.length !== b.length) return false;
  return a.every((token, i) => token === b[i]);
}
