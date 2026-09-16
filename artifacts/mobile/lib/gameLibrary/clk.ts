/**
 * Extract [%clk …] annotations from PGN move comments.
 */
const CLK_RE = /\[%\s*clk\s+([0-9:.]+)\]/i;

/** Returns the first [%clk H:MM:SS] value in a comment, if any. */
export function extractClkFromComment(comment: string | undefined): string | undefined {
  if (!comment) return undefined;
  const m = comment.match(CLK_RE);
  const value = m?.[1]?.trim();
  return value && value.length > 0 ? value : undefined;
}

/** Strip clk tags (and trim) for optional display of remaining prose. */
export function stripClkTags(comment: string | undefined): string | undefined {
  if (!comment) return undefined;
  const cleaned = comment.replace(CLK_RE, '').replace(/\s+/g, ' ').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
