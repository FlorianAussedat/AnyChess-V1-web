/**
 * Position-only PGN (Analyser la position): terminal FEN, side to move,
 * no move list and no repertoire comments.
 */
export function exportPositionPgn(options: {
  fen: string;
  headers?: Record<string, string | undefined>;
}): string {
  const fen = options.fen.trim();
  const extra = options.headers ?? {};
  const tags: Array<[string, string]> = [
    ['Event', extra.Event || 'AnyChess'],
    ['Site', extra.Site || 'AnyChess'],
    ['Result', extra.Result || '*'],
    ['SetUp', '1'],
    ['FEN', fen],
  ];
  const seen = new Set(tags.map(([k]) => k));
  for (const [key, val] of Object.entries(extra)) {
    if (seen.has(key) || val == null || val === '') continue;
    tags.push([key, val]);
    seen.add(key);
  }
  const lines = tags.map(([k, v]) => `[${k} "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
  lines.push('', '*', '');
  return lines.join('\n');
}
