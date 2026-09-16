import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { Chess } from 'chess.js';
import type { RawCandidate } from './candidateTypes.ts';
import { normalizeFenKey } from './fenUtils.ts';

/**
 * Import draw candidates from local PGN files (offline only).
 * Looks in data/defend-draw-pgn/ relative to mobile package root.
 */
export function importPgnCandidates(pgnDir: string): RawCandidate[] {
  if (!existsSync(pgnDir)) return [];
  const out: RawCandidate[] = [];
  const seen = new Set<string>();

  for (const file of readdirSync(pgnDir)) {
    if (!/\.pgn$/i.test(file)) continue;
    const text = readFileSync(join(pgnDir, file), 'utf8');
    const games = text.split(/\n\n(?=\[)/);
    for (const game of games) {
      const headers = parseHeaders(game);
      const moves = extractMoveText(game);
      if (!moves) continue;
      try {
        const chess = new Chess();
        chess.loadPgn(`${game}\n\n${moves}`.trim());
        const history = chess.history({ verbose: true });
        if (history.length < 8) continue;
        // Sample late endgame positions (last 12 plies)
        const startIdx = Math.max(0, history.length - 12);
        const replay = new Chess();
        for (let i = 0; i < startIdx; i++) replay.move(history[i]!);
        for (let i = startIdx; i < history.length; i++) {
          replay.move(history[i]!);
          const fen = replay.fen();
          const key = normalizeFenKey(fen);
          if (seen.has(key)) continue;
          seen.add(key);
          if (replay.isGameOver()) continue;
          const stm = replay.turn();
          out.push({
            fen,
            defenderColor: stm,
            theme: 'master-game',
            label: headers.Event ?? 'Partie',
            source: {
              type: 'master-game',
              white: headers.White,
              black: headers.Black,
              event: headers.Event,
              year: headers.Date ? parseInt(headers.Date.slice(0, 4), 10) : undefined,
              move: Math.ceil((i + 1) / 2),
            },
          });
        }
      } catch {
        // skip malformed games
      }
    }
  }
  return out;
}

function parseHeaders(pgn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of pgn.split('\n')) {
    const m = line.match(/^\[(\w+)\s+"(.*)"\]$/);
    if (m) out[m[1]!] = m[2]!;
  }
  return out;
}

function extractMoveText(pgn: string): string | null {
  const lines = pgn.split('\n').filter((l) => !l.startsWith('['));
  const text = lines.join(' ').trim();
  return text.length > 0 ? text : null;
}
