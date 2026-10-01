const DIRECTIVE_RE = /\[%[^\]]+\]/g;
const FEN_RE =
  /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?: [wb] [KQkq-]+ [a-h1-8-] \d+ \d+)?\b/g;
const SAN_RE =
  /\b(?:[NBRQK][a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|[a-h]x?[a-h]?[1-8](?:=[NBRQ])?[+#]?|O-O-O|O-O)\b/g;

export type ProtectedComment = {
  masked: string;
  tokens: string[];
};

export function protectCommentTokens(text: string): ProtectedComment {
  const tokens: string[] = [];
  const mask = (match: string) => {
    const idx = tokens.length;
    tokens.push(match);
    return `__T${idx}__`;
  };
  let masked = text.replace(DIRECTIVE_RE, mask);
  masked = masked.replace(FEN_RE, mask);
  masked = masked.replace(SAN_RE, mask);
  return { masked, tokens };
}

export function restoreCommentTokens(masked: string, tokens: readonly string[]): string {
  return masked.replace(/__T(\d+)__/g, (_, raw: string) => {
    const idx = Number(raw);
    return tokens[idx] ?? '';
  });
}

export function tokensUnchanged(original: string, translated: string): boolean {
  const a = original.match(DIRECTIVE_RE) ?? [];
  const b = translated.match(DIRECTIVE_RE) ?? [];
  if (a.length !== b.length) return false;
  return a.every((token, i) => token === b[i]);
}

export function stripTechnicalComment(text: string): string {
  return text.replace(DIRECTIVE_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function isTechnicalOnlyComment(text: string): boolean {
  return stripTechnicalComment(text).length === 0;
}
