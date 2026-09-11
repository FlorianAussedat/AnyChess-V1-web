import { Chess } from 'chess.js';

export function uciPvToSan(fen: string, pv: string[], maxPlies = 8): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv.slice(0, maxPlies)) {
    if (!uci || uci.length < 4) break;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci[4]!.toLowerCase() : undefined;
    try {
      const move = chess.move({ from, to, promotion });
      if (!move) break;
      out.push(move.san);
    } catch {
      break;
    }
  }
  return out;
}

export function uciToSan(
  fen: string,
  uci: string | undefined | null,
): string | null {
  if (!uci || uci.length < 4) return null;
  return uciPvToSan(fen, [uci], 1)[0] ?? null;
}
