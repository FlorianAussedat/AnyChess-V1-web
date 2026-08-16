/**
 * Compact opening/variation label from imported PGN metadata.
 * Never invents a variation from the board — only uses provided fields
 * (and optional ECO name when the project already has that database).
 */
export type OpeningDisplayInput = {
  /** Single game headers (Opening / Variation / SubVariation / …). */
  headers?: Record<string, string> | null;
  /** Merged repertoire headers — first useful Opening wins; variations may refine. */
  headersList?: Array<Record<string, string>> | null;
  /** Optional ECO/name from the existing openings.json identifier. */
  ecoName?: string | null;
  /** Optional continue-line source label. */
  sourceLabel?: string | null;
};

function headerValue(headers: Record<string, string>, key: string): string {
  const direct = headers[key]?.trim();
  if (direct) return direct;
  const found = Object.entries(headers).find(
    ([k, v]) => k.toLowerCase() === key.toLowerCase() && v.trim().length > 0,
  );
  return found?.[1]?.trim() ?? '';
}

function partsFromHeaders(headers: Record<string, string>): string[] {
  const opening = headerValue(headers, 'Opening');
  const variation = headerValue(headers, 'Variation');
  const sub = headerValue(headers, 'SubVariation') || headerValue(headers, 'Subvariation');
  const parts: string[] = [];
  for (const p of [opening, variation, sub]) {
    if (!p) continue;
    if (parts.some((x) => x.toLowerCase() === p.toLowerCase())) continue;
    parts.push(p);
  }
  return parts;
}

/**
 * Build "Italian Game · Giuoco Piano" style label, or null when unknown.
 */
export function getOpeningDisplayName(input: OpeningDisplayInput): string | null {
  const collected: string[] = [];

  if (input.headers) {
    for (const p of partsFromHeaders(input.headers)) {
      if (!collected.some((x) => x.toLowerCase() === p.toLowerCase())) {
        collected.push(p);
      }
    }
  }

  if (collected.length === 0 && input.headersList?.length) {
    // Prefer the first header set that carries an Opening; then enrich Variation.
    let best: string[] = [];
    for (const h of input.headersList) {
      const parts = partsFromHeaders(h);
      if (parts.length === 0) continue;
      if (best.length === 0) best = parts;
      if (parts.length > best.length) best = parts;
      if (headerValue(h, 'Opening') && headerValue(h, 'Variation')) {
        best = parts;
        break;
      }
    }
    collected.push(...best);
  }

  if (collected.length === 0 && input.sourceLabel?.trim()) {
    collected.push(input.sourceLabel.trim());
  }

  if (collected.length === 0 && input.ecoName?.trim()) {
    collected.push(input.ecoName.trim());
  }

  if (collected.length === 0) return null;
  return collected.join(' · ');
}
