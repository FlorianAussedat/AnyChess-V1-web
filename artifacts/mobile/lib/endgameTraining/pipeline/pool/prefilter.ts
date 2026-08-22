/**
 * Lichess metadata prefilter — structural only, no engine.
 */
import { Chess } from 'chess.js';
import type { LichessPuzzleRow } from '../lichessCsv.ts';
import { pieceCountFromFen } from './family.ts';

const REJECT_THEMES = new Set([
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'oneMove',
  'opening',
  'middlegame',
  'advantage',
  'crushing',
  'master',
  'masterVsMaster',
  'superGM',
]);

const PREFERRED_THEMES = new Set([
  'endgame',
  'long',
  'veryLong',
  'pawnEndgame',
  'rookEndgame',
  'bishopEndgame',
  'knightEndgame',
  'queenEndgame',
  'defensiveMove',
  'zugzwang',
  'fortress',
]);

export type PrefilterResult =
  | { ok: true; score: number }
  | { ok: false; reason: string };

function parseIntField(raw: Record<string, string>, key: string): number | null {
  const v = raw[key];
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function prefilterLichessRow(row: LichessPuzzleRow): PrefilterResult {
  const themes = row.themes.map((t) => t.trim()).filter(Boolean);
  const themeSet = new Set(themes);

  if (!themeSet.has('endgame')) {
    return { ok: false, reason: 'no-endgame-theme' };
  }

  for (const t of themes) {
    if (REJECT_THEMES.has(t)) {
      return { ok: false, reason: `reject-theme:${t}` };
    }
  }

  const pieces = pieceCountFromFen(row.fen);
  if (pieces < 5 || pieces > 7) {
    return { ok: false, reason: 'piece-count' };
  }

  try {
    const game = new Chess(row.fen);
    if (game.isGameOver()) {
      return { ok: false, reason: 'terminal-start' };
    }
    if (game.isCheckmate()) {
      return { ok: false, reason: 'checkmate-start' };
    }
  } catch {
    return { ok: false, reason: 'illegal-fen' };
  }

  const popularity = parseIntField(row.raw, 'Popularity');
  const nbPlays = parseIntField(row.raw, 'NbPlays');
  if (popularity != null && popularity < 50) {
    return { ok: false, reason: 'low-popularity' };
  }
  if (nbPlays != null && nbPlays < 20) {
    return { ok: false, reason: 'low-nb-plays' };
  }

  let score = 0;
  for (const t of themes) {
    if (PREFERRED_THEMES.has(t)) score += 2;
  }
  if (themeSet.has('long')) score += 3;
  if (themeSet.has('veryLong')) score += 5;
  if (row.rating != null && row.rating >= 1200 && row.rating <= 2200) score += 1;
  if (popularity != null && popularity >= 85) score += 2;
  if (nbPlays != null && nbPlays >= 500) score += 2;

  return { ok: true, score };
}
