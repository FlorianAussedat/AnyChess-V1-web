import { isTechnicalOnlyComment, stripTechnicalComment } from './protectTokens.ts';
import type { PgnCommentLanguage } from './types.ts';

const FR_HINTS =
  /\b(le|la|les|un|une|des|du|de|et|est|aux|cette|coup|pion|cavaliers?|fous?|tours?|dame|roi|blancs?|noirs?|échec|nulle|variante|qualité)\b/i;
const EN_HINTS =
  /\b(the|and|with|this|that|move|pawn|knight|bishop|rook|queen|king|white|black|check|draw|pin|fork|passed|kingside|queenside)\b/i;

export function detectCommentLanguage(text: string): PgnCommentLanguage {
  const prose = stripTechnicalComment(text);
  if (!prose) return 'unknown';
  const fr = FR_HINTS.test(prose);
  const en = EN_HINTS.test(prose);
  if (fr && !en) return 'fr';
  if (en && !fr) return 'en';
  if (fr && en) return 'other';
  return 'unknown';
}

export function shouldQueueEnglishComment(text: string): boolean {
  if (isTechnicalOnlyComment(text)) return false;
  return detectCommentLanguage(text) === 'en';
}
