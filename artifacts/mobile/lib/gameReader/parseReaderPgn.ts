/**
 * Robust PGN → ReaderGame with a navigable variation tree.
 * Main line and side lines are legalized once with chess.js.
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
  ReaderNode,
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

function fingerprintOf(
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

function nodeToMove(node: ReaderNode, ply: number): ReaderMove {
  return {
    ply,
    moveNumber: node.moveNumber,
    color: node.color,
    san: node.san,
    fenBefore: node.fenBefore,
    fenAfter: node.fenAfter,
    from: node.from,
    to: node.to,
    promotion: node.promotion,
    comment: node.comment,
    nags: node.nags,
    hasVariations: node.childIds.length > 1 || undefined,
    nodeId: node.id,
  };
}

/**
 * Convert a PGN node and its sibling variations (alternatives to this move)
 * into ReaderNodes under the same parent / fenBefore.
 */
function convertSiblings(
  pgnNode: PgnMoveNode | null,
  parentId: string | null,
  fenBefore: string,
  depth: number,
  nodesById: Record<string, ReaderNode>,
  idSeq: { n: number },
): { ids: string[]; error?: string } {
  if (!pgnNode) return { ids: [] };

  const siblings: PgnMoveNode[] = [pgnNode, ...pgnNode.variations];
  const ids: string[] = [];

  for (let variationIndex = 0; variationIndex < siblings.length; variationIndex += 1) {
    const step = siblings[variationIndex]!;
    const chess = new Chess(fenBefore);
    const color = sideFromFen(fenBefore);
    let played;
    try {
      played = chess.move(step.san);
    } catch {
      return { ids: [], error: `Coup illégal « ${step.san} ».` };
    }
    if (!played) {
      return { ids: [], error: `Coup illégal « ${step.san} ».` };
    }

    idSeq.n += 1;
    const id = `n${idSeq.n}`;
    const fenAfter = chess.fen();
    const comment = step.comment;
    void extractClkFromComment(comment);

    const nodeDepth = variationIndex === 0 ? depth : depth + 1;
    const childResult = convertSiblings(
      step.next,
      id,
      fenAfter,
      nodeDepth,
      nodesById,
      idSeq,
    );
    if (childResult.error) {
      return { ids: [], error: childResult.error };
    }

    const fullMove = Number(fenBefore.split(' ')[5] ?? '1');
    const node: ReaderNode = {
      id,
      san: played.san,
      fenBefore,
      fenAfter,
      from: played.from,
      to: played.to,
      promotion: played.promotion,
      moveNumber: fullMove,
      color,
      comment,
      nags: step.nags.length > 0 ? [...step.nags] : undefined,
      parentId,
      childIds: childResult.ids,
      variationIndex,
      depth: nodeDepth,
    };
    nodesById[id] = node;
    ids.push(id);
  }

  return { ids };
}

function mainLineMoves(
  nodesById: Record<string, ReaderNode>,
  rootIds: string[],
): ReaderMove[] {
  const moves: ReaderMove[] = [];
  let id: string | null = rootIds[0] ?? null;
  let ply = 0;
  while (id) {
    const node: ReaderNode | undefined = nodesById[id];
    if (!node) break;
    ply += 1;
    moves.push(nodeToMove(node, ply));
    id = node.childIds[0] ?? null;
  }
  return moves;
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
 * Build a ReaderGame from one parsed PGN tree (full variation tree).
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

  try {
    new Chess(initialFen);
  } catch {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'FEN de départ invalide.',
    };
  }

  if (!root && !options.allowEmptyMoves) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'Aucun coup jouable.',
    };
  }

  const nodesById: Record<string, ReaderNode> = {};
  const idSeq = { n: 0 };
  const converted = convertSiblings(root, null, initialFen, 0, nodesById, idSeq);
  if (converted.error) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: converted.error,
    };
  }

  const rootIds = converted.ids;
  const moves = mainLineMoves(nodesById, rootIds);

  if (moves.length === 0 && !options.allowEmptyMoves) {
    return {
      ok: false,
      error: 'Impossible de lire cette partie.',
      detail: 'Aucun coup jouable.',
    };
  }

  const importedAt = options.importedAt ?? Date.now();
  const rawPgn = options.rawPgn;
  const game: ReaderGame = {
    id: options.id ?? createId(),
    fingerprint: fingerprintOf(
      headers,
      initialFen,
      moves.map((m) => m.san),
    ),
    headers,
    initialFen,
    moves,
    nodesById,
    rootIds,
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
  const rawPgn = input.rawPgn ?? input.source?.rawPgn;
  if (rawPgn && rawPgn.trim().length > 0) {
    const parsed = parseReaderPgn(rawPgn, {
      id: input.id,
      fileName: input.source?.fileName,
      importedAt: input.source?.importedAt,
      allowEmptyMoves: true,
    });
    if (parsed.ok) {
      return {
        ...parsed.game,
        id: input.id,
        fingerprint: input.fingerprint ?? parsed.game.fingerprint,
        source: input.source ?? parsed.game.source,
      };
    }
  }

  let chess: Chess;
  try {
    chess = new Chess(input.initialFen);
  } catch {
    chess = new Chess(STANDARD_START_FEN);
  }

  const nodesById: Record<string, ReaderNode> = {};
  const moves: ReaderMove[] = [];
  let parentId: string | null = null;
  let rootIds: string[] = [];

  for (let i = 0; i < input.moves.length; i += 1) {
    const m = input.moves[i]!;
    const fenBefore = chess.fen();
    const color = sideFromFen(fenBefore);
    let played;
    try {
      played = chess.move(m.san);
    } catch {
      played = null;
    }
    const id = `n${i + 1}`;
    let fenAfter = m.fenAfter;
    let from: string | undefined;
    let to: string | undefined;
    let promotion: string | undefined;
    let san = m.san;

    if (played) {
      fenAfter = chess.fen();
      from = played.from;
      to = played.to;
      promotion = played.promotion;
      san = played.san;
    } else {
      try {
        chess.load(m.fenAfter);
      } catch {
        /* keep going */
      }
    }

    const node: ReaderNode = {
      id,
      san,
      fenBefore,
      fenAfter,
      from,
      to,
      promotion,
      moveNumber: Math.ceil(m.ply / 2),
      color,
      comment: m.comment,
      nags: m.nags,
      parentId,
      childIds: [],
      variationIndex: 0,
      depth: 0,
    };
    nodesById[id] = node;
    if (parentId && nodesById[parentId]) {
      nodesById[parentId]!.childIds = [id];
    } else {
      rootIds = [id];
    }
    parentId = id;
    moves.push(nodeToMove(node, m.ply));
  }

  return {
    id: input.id,
    fingerprint: input.fingerprint,
    headers: input.headers,
    initialFen: input.initialFen,
    moves,
    nodesById,
    rootIds,
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
    nodesById: {},
    rootIds: [],
    hasVariations: false,
  };
}
