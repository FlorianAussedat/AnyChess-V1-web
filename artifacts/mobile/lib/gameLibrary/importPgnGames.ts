/**
 * Import PGN text into ImportedChessGame records (main line only).
 * Reuses repertoire parsePgn / splitGames; validates moves with chess.js.
 * Side variations are preserved in source.rawPgn but not played in V1.
 */
import { Chess } from 'chess.js';
import {
  parsePgn,
  splitGames,
  PgnSyntaxError,
  type PgnMoveNode,
} from '../repertoire/pgnParser.ts';
import { extractClkFromComment } from './clk.ts';
import type {
  ImportedChessGame,
  ImportedGameHeaders,
  ImportedGameMove,
  ImportPgnResult,
} from './types.ts';

const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function headerValue(headers: Record<string, string>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = headers[key];
    if (typeof v === 'string' && v.trim().length > 0 && v.trim() !== '?') {
      return v.trim();
    }
  }
  return undefined;
}

export function mapPgnHeaders(raw: Record<string, string>): ImportedGameHeaders {
  return {
    white: headerValue(raw, 'White'),
    black: headerValue(raw, 'Black'),
    result: headerValue(raw, 'Result'),
    event: headerValue(raw, 'Event'),
    site: headerValue(raw, 'Site'),
    date: headerValue(raw, 'Date'),
    round: headerValue(raw, 'Round'),
    whiteElo: headerValue(raw, 'WhiteElo'),
    blackElo: headerValue(raw, 'BlackElo'),
    timeControl: headerValue(raw, 'TimeControl'),
    eco: headerValue(raw, 'ECO'),
    opening: headerValue(raw, 'Opening'),
    variation: headerValue(raw, 'Variation'),
  };
}

function walkMainLine(
  root: PgnMoveNode | null,
): Array<{ san: string; comment?: string; nags: string[] }> {
  const out: Array<{ san: string; comment?: string; nags: string[] }> = [];
  let node = root;
  while (node) {
    out.push({ san: node.san, comment: node.comment, nags: [...node.nags] });
    // Variations on this node are preserved in the parse tree / rawPgn but ignored for V1 playback.
    node = node.next;
  }
  return out;
}

function treeHasVariations(root: PgnMoveNode | null): boolean {
  let node = root;
  while (node) {
    if (node.variations.length > 0) return true;
    for (const v of node.variations) {
      if (treeHasVariations(v)) return true;
    }
    node = node.next;
  }
  return false;
}

function reconstructRawPgn(headers: Record<string, string>, movetext: string): string {
  const lines = Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`);
  return `${lines.join('\n')}\n\n${movetext.trim()}`.trim();
}

/** Stable fingerprint independent of filename. */
export function fingerprintGame(
  headers: ImportedGameHeaders,
  initialFen: string,
  sans: readonly string[],
): string {
  const parts = [
    headers.white ?? '',
    headers.black ?? '',
    headers.result ?? '',
    headers.date ?? '',
    headers.event ?? '',
    initialFen,
    sans.join(' '),
  ];
  return parts.join('|');
}

function createId(): string {
  return `game_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export type BuildImportedGameOptions = {
  fileName?: string;
  importedAt?: number;
  existingFingerprints?: ReadonlySet<string>;
  rawPgn?: string;
};

/**
 * Convert one parsed PGN game into a validated imported game, or null if invalid.
 */
export function buildImportedGameFromPgnGame(
  rawHeaders: Record<string, string>,
  root: PgnMoveNode | null,
  options: BuildImportedGameOptions = {},
): { game: ImportedChessGame | null; error?: string } {
  const headers = mapPgnHeaders(rawHeaders);
  const setup = headerValue(rawHeaders, 'SetUp') === '1';
  const fenHeader = headerValue(rawHeaders, 'FEN');
  const initialFen = setup && fenHeader ? fenHeader : fenHeader ?? STANDARD_START_FEN;

  let chess: Chess;
  try {
    chess = new Chess(initialFen);
  } catch {
    return { game: null, error: 'Invalid starting FEN' };
  }

  const main = walkMainLine(root);
  if (main.length === 0 && !(setup && fenHeader)) {
    return { game: null, error: 'No playable moves in game' };
  }

  const moves: ImportedGameMove[] = [];
  for (let i = 0; i < main.length; i += 1) {
    const step = main[i]!;
    let played;
    try {
      played = chess.move(step.san);
    } catch {
      return {
        game: null,
        error: `Illegal move "${step.san}" at ply ${i + 1}`,
      };
    }
    if (!played) {
      return {
        game: null,
        error: `Illegal move "${step.san}" at ply ${i + 1}`,
      };
    }
    moves.push({
      ply: i + 1,
      san: played.san,
      fenAfter: chess.fen(),
      comment: step.comment,
      clock: extractClkFromComment(step.comment),
      nags: step.nags.length > 0 ? step.nags : undefined,
    });
  }

  const fingerprint = fingerprintGame(
    headers,
    initialFen,
    moves.map((m) => m.san),
  );
  if (options.existingFingerprints?.has(fingerprint)) {
    return { game: null, error: 'duplicate' };
  }

  return {
    game: {
      id: createId(),
      fingerprint,
      headers,
      initialFen,
      moves,
      hasVariations: treeHasVariations(root),
      source: {
        fileName: options.fileName,
        importedAt: options.importedAt ?? Date.now(),
        rawPgn: options.rawPgn,
      },
    },
  };
}

/**
 * Import all games from a (possibly multi-game) PGN string.
 * Valid games are kept; invalid ones are counted and reported.
 */
export function importPgnGames(
  pgnText: string,
  options: BuildImportedGameOptions = {},
): ImportPgnResult {
  const text = typeof pgnText === 'string' ? pgnText.trim() : '';
  const errors: string[] = [];
  if (!text) {
    return {
      imported: [],
      skippedDuplicates: 0,
      skippedInvalid: 0,
      errors: ['Empty PGN'],
    };
  }

  let rawBlocks;
  try {
    rawBlocks = splitGames(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Malformed PGN';
    return {
      imported: [],
      skippedDuplicates: 0,
      skippedInvalid: 1,
      errors: [message],
    };
  }

  if (rawBlocks.length === 0) {
    return {
      imported: [],
      skippedDuplicates: 0,
      skippedInvalid: 0,
      errors: ['No games found in PGN'],
    };
  }

  let parsed;
  try {
    parsed = parsePgn(text);
  } catch (e) {
    const message =
      e instanceof PgnSyntaxError
        ? e.message
        : e instanceof Error
          ? e.message
          : 'Malformed PGN';
    return {
      imported: [],
      skippedDuplicates: 0,
      skippedInvalid: 1,
      errors: [message],
    };
  }

  const existing = new Set(options.existingFingerprints ?? []);
  const imported: ImportedChessGame[] = [];
  let skippedDuplicates = 0;
  let skippedInvalid = 0;

  parsed.forEach((g, index) => {
    const raw = rawBlocks[index];
    const rawPgn = raw
      ? reconstructRawPgn(raw.headers, raw.movetext)
      : undefined;
    const result = buildImportedGameFromPgnGame(g.headers, g.root, {
      ...options,
      existingFingerprints: existing,
      rawPgn,
    });
    if (result.game) {
      imported.push(result.game);
      existing.add(result.game.fingerprint);
      return;
    }
    if (result.error === 'duplicate') {
      skippedDuplicates += 1;
      return;
    }
    skippedInvalid += 1;
    errors.push(`Game ${index + 1}: ${result.error ?? 'invalid'}`);
  });

  return { imported, skippedDuplicates, skippedInvalid, errors };
}

/** FEN at a given ply cursor (0 = initial). */
export function fenAtPly(game: ImportedChessGame, ply: number): string {
  if (ply <= 0) return game.initialFen;
  const move = game.moves[Math.min(ply, game.moves.length) - 1];
  return move?.fenAfter ?? game.initialFen;
}

/** SAN of the move that led to `ply` (ply >= 1). */
export function sanAtPly(game: ImportedChessGame, ply: number): string | null {
  if (ply < 1 || ply > game.moves.length) return null;
  return game.moves[ply - 1]?.san ?? null;
}
