/**
 * Robust PGN → ReaderGame. Main line is legalized with chess.js.
 * Comments / NAGs / variation flags are preserved; side lines stay in rawPgn.
 */
import { Chess } from 'chess.js';
import {
  parsePgn,
  splitGames,
  PgnSyntaxError,
  type PgnMoveNode,
} from '../repertoire/pgnParser.ts';
import { extractClkFromComment } from '../gameLibrary/clk.ts';
import type {
  ParsePgnResult,
  ReaderColor,
  ReaderGame,
  ReaderHeaders,
  ReaderMove,
} from './types.ts';

export const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function headerValue(
  headers: Record<string, string>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const v = headers[key];
    if (typeof v === 'string' && v.trim().length > 0 && v.trim() !== '?') {
      return v.trim();
    }
  }
  return undefined;
}

function mapHeaders(raw: Record<string, string>): ReaderHeaders {
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

function walkMainLine(root: PgnMoveNode | null): PgnMoveNode[] {
  const out: PgnMoveNode[] = [];
  let node = root;
  while (node) {
    out.push(node);
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

function reconstructRawPgn(
  headers: Record<string, string>,
  movetext: string,
): string {
  const lines = Object.entries(headers).map(([k, v]) => `[${k} "${v}"]`);
  return `${lines.join('\n')}\n\n${movetext.trim()}`.trim();
}

function createId(prefix = 'reader'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function sideFromFen(fen: string): ReaderColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function fingerprint(
  headers: ReaderHeaders,
  initialFen: string,
  sans: readonly string[],
): string {
  return [
    headers.white ?? '',
    headers.black ?? '',
    headers.result ?? '',
    headers.date ?? '',
    headers.event ?? '',
    initialFen,
    sans.join(' '),
  ].join('|');
}

export type BuildReaderGameOptions = {
  id?: string;
  /** Allow FEN-only / empty movetext (Analyseur). */
  allowEmptyMoves?: boolean;
  rawPgn?: string;
  fileName?: string;
  importedAt?: number;
};

/**
 * Build a ReaderGame from one parsed PGN tree.
 * Empty movetext is allowed when `allowEmptyMoves` (Analyseur / FEN-only).
 */
export function buildReaderGameFromPgnTree(
  rawHeaders: Record<string, string>,
  root: PgnMoveNode | null,
  options: BuildReaderGameOptions = {},
): ParsePgnResult {
  const headers = mapHeaders(rawHeaders);
  const setup = headerValue(rawHeaders, 'SetUp') === '1';
  const fenHeader = headerValue(rawHeaders, 'FEN');
  const initialFen =
    setup && fenHeader ? fenHeader : fenHeader ?? STANDARD_START_FEN;

  let chess: Chess;
  try {
    chess = new Chess(initialFen);
  } catch {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'FEN de départ invalide.',
    };
  }

  const main = walkMainLine(root);
  if (main.length === 0 && !options.allowEmptyMoves) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'Aucun coup jouable.',
    };
  }

  const moves: ReaderMove[] = [];
  for (let i = 0; i < main.length; i += 1) {
    const step = main[i]!;
    const fenBefore = chess.fen();
    const color = sideFromFen(fenBefore);
    let played;
    try {
      played = chess.move(step.san);
    } catch {
      return {
        ok: false,
        error: 'Impossible de lire cette partie.',
        detail: `Coup illégal « ${step.san} » (ply ${i + 1}).`,
      };
    }
    if (!played) {
      return {
        ok: false,
        error: 'Impossible de lire cette partie.',
        detail: `Coup illégal « ${step.san} » (ply ${i + 1}).`,
      };
    }
    const ply = i + 1;
    const comment = step.comment;
    moves.push({
      ply,
      moveNumber: Math.ceil(ply / 2),
      color,
      san: played.san,
      fenBefore,
      fenAfter: chess.fen(),
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      comment,
      nags: step.nags.length > 0 ? [...step.nags] : undefined,
      hasVariations: step.variations.length > 0,
    });
    // Keep clk extraction wired for Lecteur overlays without a second parse.
    void extractClkFromComment(comment);
  }

  const importedAt = options.importedAt ?? Date.now();
  const rawPgn = options.rawPgn;
  const game: ReaderGame = {
    id: options.id ?? createId(),
    fingerprint: fingerprint(
      headers,
      initialFen,
      moves.map((m) => m.san),
    ),
    headers,
    initialFen,
    moves,
    result: headers.result,
    hasVariations: treeHasVariations(root),
    rawPgn,
    source: {
      fileName: options.fileName,
      importedAt,
      rawPgn,
    },
  };
  return { ok: true, game };
}

/** Parse the first game of a PGN string into a ReaderGame. */
export function parseReaderPgn(
  pgnText: string,
  options: BuildReaderGameOptions = {},
): ParsePgnResult {
  const text = typeof pgnText === 'string' ? pgnText.trim() : '';
  if (!text) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'PGN vide.',
    };
  }

  let rawBlocks;
  try {
    rawBlocks = splitGames(text);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'PGN mal formé.';
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: message,
    };
  }

  if (rawBlocks.length === 0) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'Aucune partie trouvée.',
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
          : 'PGN mal formé.';
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: message,
    };
  }

  if (parsed.length === 0) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'Aucune partie trouvée.',
    };
  }

  const first = parsed[0]!;
  const raw = rawBlocks[0];
  const rawPgn = raw
    ? reconstructRawPgn(raw.headers, raw.movetext)
    : options.rawPgn ?? text;

  return buildReaderGameFromPgnTree(first.headers, first.root, {
    ...options,
    rawPgn,
  });
}

/** Adapt an imported library game into the shared ReaderGame model. */
export function readerGameFromImported(input: {
  id: string;
  fingerprint?: string;
  headers: ReaderHeaders;
  initialFen: string;
  moves: Array<{
    ply: number;
    san: string;
    fenAfter: string;
    comment?: string;
    nags?: string[];
  }>;
  hasVariations?: boolean;
  rawPgn?: string;
  source?: ReaderGame['source'];
}): ReaderGame {
  let chess: Chess;
  try {
    chess = new Chess(input.initialFen);
  } catch {
    chess = new Chess(STANDARD_START_FEN);
  }

  const moves: ReaderMove[] = [];
  for (const m of input.moves) {
    const fenBefore = chess.fen();
    const color = sideFromFen(fenBefore);
    let played;
    try {
      played = chess.move(m.san);
    } catch {
      played = null;
    }
    if (!played) {
      moves.push({
        ply: m.ply,
        moveNumber: Math.ceil(m.ply / 2),
        color,
        san: m.san,
        fenBefore,
        fenAfter: m.fenAfter,
        comment: m.comment,
        nags: m.nags,
      });
      try {
        chess.load(m.fenAfter);
      } catch {
        /* keep going */
      }
      continue;
    }
    moves.push({
      ply: m.ply,
      moveNumber: Math.ceil(m.ply / 2),
      color,
      san: played.san,
      fenBefore,
      fenAfter: chess.fen(),
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      comment: m.comment,
      nags: m.nags,
    });
  }

  const rawPgn = input.rawPgn ?? input.source?.rawPgn;
  return {
    id: input.id,
    fingerprint: input.fingerprint,
    headers: input.headers,
    initialFen: input.initialFen,
    moves,
    result: input.headers.result,
    hasVariations: Boolean(input.hasVariations),
    rawPgn,
    source: input.source ?? {
      importedAt: Date.now(),
      rawPgn,
    },
  };
}

export function emptyReaderGame(fen = STANDARD_START_FEN): ReaderGame {
  try {
    new Chess(fen);
  } catch {
    return emptyReaderGame(STANDARD_START_FEN);
  }
  return {
    id: createId('empty'),
    headers: {},
    initialFen: fen,
    moves: [],
    hasVariations: false,
  };
}
