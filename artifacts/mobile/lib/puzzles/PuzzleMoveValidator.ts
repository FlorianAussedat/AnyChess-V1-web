/**
 * Compare expected solution UCI vs attempted move (exact match for now).
 * Prepared for a future alternatives array without changing call sites much.
 */
export function normalizeUci(uci: string): string {
  const u = uci.trim().toLowerCase();
  if (u.length < 4) return u;
  const from = u.slice(0, 2);
  const to = u.slice(2, 4);
  const promo = u.slice(4);
  // Default promotion letter lowercased; empty if none.
  return `${from}${to}${promo}`;
}

export function uciFromSquares(from: string, to: string, promotion?: string | null): string {
  return normalizeUci(`${from}${to}${promotion ?? ''}`);
}

/**
 * Exact match against the principal line, optionally accepting alternatives later.
 */
export function isExpectedMove(
  expectedUci: string,
  attemptedUci: string,
  alternatives?: string[],
): boolean {
  const attempt = normalizeUci(attemptedUci);
  if (normalizeUci(expectedUci) === attempt) return true;
  if (alternatives?.some((alt) => normalizeUci(alt) === attempt)) return true;
  return false;
}
