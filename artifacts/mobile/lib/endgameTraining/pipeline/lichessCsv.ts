/**
 * Parse official Lichess puzzle CSV (and optional .gz).
 *
 * Columns (typical): PuzzleId,FEN,Moves,Rating,Themes,...
 * - FEN is the position BEFORE the first move of Moves
 * - First UCI in Moves is the game blunder that creates the puzzle
 *
 * For AnyChess endgame training we keep the position BEFORE the error:
 *   startFen = CSV FEN
 *   errorMove = first UCI
 *   afterErrorFen = apply errorMove
 *   defender = side to move in startFen (the side that blundered)
 *
 * .zst: decompress with `zstd -d` first, or ensure `zstd` is on PATH —
 * this module will try `zstd -dc` via child_process when the path ends with .zst.
 */
import { createReadStream, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { gunzipSync, createGunzip } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { Chess } from 'chess.js';
import type { DefenderColor } from '../domain/types.ts';

export type LichessPuzzleRow = {
  puzzleId: string;
  fen: string;
  moves: string[];
  rating: number | null;
  themes: string[];
  raw: Record<string, string>;
};

export type ParsedLichessCandidate = {
  puzzleId: string;
  startFen: string;
  errorMove: string;
  afterErrorFen: string;
  defender: DefenderColor;
  rating: number | null;
  themes: string[];
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function headerIndex(headers: string[], name: string): number {
  const i = headers.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  return i;
}

/**
 * Apply a UCI move (e2e4 / e7e8q) to a FEN. Returns null if illegal.
 */
export function applyUci(fen: string, uci: string): string | null {
  const clean = uci.trim();
  if (clean.length < 4) return null;
  const from = clean.slice(0, 2);
  const to = clean.slice(2, 4);
  const promotion = clean.length > 4 ? clean[4]!.toLowerCase() : undefined;
  try {
    const game = new Chess(fen);
    const move = game.move({
      from,
      to,
      promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined,
    });
    if (!move) return null;
    return game.fen();
  } catch {
    return null;
  }
}

export function parseLichessPuzzleRow(
  headers: string[],
  cells: string[],
): LichessPuzzleRow | null {
  const idIdx = headerIndex(headers, 'PuzzleId');
  const fenIdx = headerIndex(headers, 'FEN');
  const movesIdx = headerIndex(headers, 'Moves');
  if (idIdx < 0 || fenIdx < 0 || movesIdx < 0) return null;

  const puzzleId = (cells[idIdx] ?? '').trim();
  const fen = (cells[fenIdx] ?? '').trim();
  const movesRaw = (cells[movesIdx] ?? '').trim();
  if (!puzzleId || !fen || !movesRaw) return null;

  const ratingIdx = headerIndex(headers, 'Rating');
  const themesIdx = headerIndex(headers, 'Themes');
  const rating =
    ratingIdx >= 0 && cells[ratingIdx]
      ? Number.parseInt(cells[ratingIdx]!, 10)
      : null;
  const themes =
    themesIdx >= 0 && cells[themesIdx]
      ? cells[themesIdx]!.trim().split(/\s+/).filter(Boolean)
      : [];

  const raw: Record<string, string> = {};
  for (let i = 0; i < headers.length; i++) {
    raw[headers[i]!.trim()] = cells[i] ?? '';
  }

  return {
    puzzleId,
    fen,
    moves: movesRaw.split(/\s+/).filter(Boolean),
    rating: Number.isFinite(rating) ? rating : null,
    themes,
    raw,
  };
}

/**
 * Build pipeline fields from a parsed CSV row.
 * Returns null when the error move cannot be applied.
 */
export function toPipelineFields(
  row: LichessPuzzleRow,
): ParsedLichessCandidate | null {
  const errorMove = row.moves[0];
  if (!errorMove) return null;
  const afterErrorFen = applyUci(row.fen, errorMove);
  if (!afterErrorFen) return null;
  const stm = row.fen.trim().split(/\s+/)[1];
  const defender: DefenderColor = stm === 'b' ? 'black' : 'white';
  return {
    puzzleId: row.puzzleId,
    startFen: row.fen,
    errorMove,
    afterErrorFen,
    defender,
    rating: row.rating,
    themes: row.themes,
  };
}

function readTextSync(path: string): string {
  if (path.endsWith('.gz')) {
    return gunzipSync(readFileSync(path)).toString('utf8');
  }
  if (path.endsWith('.zst') || path.endsWith('.zstd')) {
    const r = spawnSync('zstd', ['-dc', path], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
    if (r.error || r.status !== 0) {
      throw new Error(
        `Cannot read ${path}: install zstd and ensure it is on PATH, or decompress to .csv first (zstd -d).`,
      );
    }
    return r.stdout;
  }
  return readFileSync(path, 'utf8');
}

/** Parse an entire CSV string (header + rows). */
export function parseLichessCsvText(text: string): LichessPuzzleRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]!);
  const rows: LichessPuzzleRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const row = parseLichessPuzzleRow(headers, cells);
    if (row) rows.push(row);
  }
  return rows;
}

export function loadLichessCsvSync(path: string): LichessPuzzleRow[] {
  return parseLichessCsvText(readTextSync(path));
}

/**
 * Async line iterator for large CSVs (supports .gz via zlib stream).
 * For .zst, falls back to sync decompress via `zstd -dc` then yields lines.
 */
export async function* iterLichessCsv(
  path: string,
): AsyncGenerator<LichessPuzzleRow> {
  if (path.endsWith('.zst') || path.endsWith('.zstd')) {
    for (const row of loadLichessCsvSync(path)) {
      yield row;
    }
    return;
  }

  const raw = createReadStream(path);
  const stream = path.endsWith('.gz') ? raw.pipe(createGunzip()) : raw;
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  let headers: string[] | null = null;
  for await (const line of rl) {
    if (!line.trim()) continue;
    if (!headers) {
      headers = splitCsvLine(line);
      continue;
    }
    const row = parseLichessPuzzleRow(headers, splitCsvLine(line));
    if (row) yield row;
  }
}
