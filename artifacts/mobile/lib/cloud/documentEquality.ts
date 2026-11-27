/** JSONB may reorder object keys and whitespace. Arrays and all string contents
 * (especially PGN/SAN/comments) remain order/byte sensitive. No stored rewrite. */
export function stableJson(value: unknown): string {
  const ordered = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(ordered);
    if (v !== null && typeof v === 'object')
      return Object.fromEntries(Object.keys(v).sort().map(k => [k, ordered((v as Record<string, unknown>)[k])]));
    return v;
  };
  return JSON.stringify(ordered(value));
}
export function documentPayloadsEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if ((a ?? null) === (b ?? null)) return true;
  if (a == null || b == null) return false;
  try { return stableJson(JSON.parse(a)) === stableJson(JSON.parse(b)); }
  catch { return false; } // Malformed documents never gain an equivalence shortcut.
}
