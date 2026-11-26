import { splitGames } from '../repertoire/pgnParser.ts';
/**
 * Serialize a ReaderGame tree to PGN and optionally enrich with evals.
 * Tree-based — never regex-match SAN across variations.
 */
import type { GameNodeAnalysis } from './types.ts';
import { uciToSan } from './uciToSan.ts';
import type { ReaderGame, ReaderNode } from '@/lib/gameReader';

function escapeHeader(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function evalComment(node: GameNodeAnalysis): string | null {
  // Standard-ish [%eval …] — mates as #N / #-N. A missing score is omitted.
  if (node.mate != null && node.mate !== 0) {
    return `[%eval #${node.mate}]`;
  }
  if (node.terminalOutcome === 'white') return '[%eval #1]';
  if (node.terminalOutcome === 'black') return '[%eval #-1]';
  if (node.terminalOutcome === 'draw') return '[%eval 0.00]';
  if (node.evaluation == null || !Number.isFinite(node.evaluation)) return null;
  const pawns = (node.evaluation / 100).toFixed(2);
  return `[%eval ${pawns}]`;
}

function commentForNode(
  game: ReaderGame,
  node: ReaderNode,
  analysisAfter: GameNodeAnalysis | undefined,
  analysisBefore: GameNodeAnalysis | undefined,
  includeEvals: boolean,
  includeBest: boolean,
): string | null {
  let original = node.comment ?? '';
  // Replace only annotations for which a new value exists; preserve authored content otherwise.
  if (includeEvals && analysisAfter)
    original = original.replace(/\[%eval\s+[^\]]+\]/g, '').trim();
  if (includeBest && analysisBefore?.bestMove)
    original = original.replace(/\bBest:\s+\S+/g, '').trim();
  const parts: string[] = [];
  if (original) parts.push(original);
  if (includeEvals && analysisAfter) {
    const evalText = evalComment(analysisAfter);
    if (evalText) parts.push(evalText);
  }
  if (includeBest && analysisBefore?.bestMove) {
    // Best is from the position BEFORE this move (parent / start analysis).
    const san = uciToSan(node.fenBefore, analysisBefore.bestMove);
    if (san) parts.push(`Best: ${san}`);
  }
  if (parts.length === 0) return null;
  return parts.join(' ');
}

function writeNode(
  game: ReaderGame,
  nodeId: string,
  opts: {
    nodes: Record<string, GameNodeAnalysis>;
    includeEvals: boolean;
    includeBest: boolean;
    forceNumber: boolean;
  },
  /** Sibling alternatives to THIS move (written after SAN, before children). */
  siblingVariationIds: string[] = [],
): string {
  const node = game.nodesById[nodeId];
  if (!node) return '';
  const analysisAfter = opts.nodes[nodeId];
  const analysisBefore = node.parentId
    ? opts.nodes[node.parentId]
    : opts.nodes[`${game.id}::start`];
  const bits: string[] = [];

  if (node.color === 'white' || opts.forceNumber) {
    bits.push(
      node.color === 'white' ? `${node.moveNumber}.` : `${node.moveNumber}...`,
    );
  }
  if (node.commentBefore) bits.push(`{ ${node.commentBefore} }`);
  // Keep +/# attached to SAN — never split.
  bits.push(node.san);

  for (const nag of node.nags ?? []) {
    bits.push(`$${nag}`);
  }

  const comment = commentForNode(
    game,
    node,
    analysisAfter,
    analysisBefore,
    opts.includeEvals,
    opts.includeBest,
  );
  if (comment) bits.push(`{ ${comment} }`);

  // PGN convention: variations come AFTER the move they replace, before
  // deeper continuation — e.g. `3. Bb5 a6 (3... Nf6) 4. Ba4`.
  for (const sibId of siblingVariationIds) {
    const varText = writeLine(game, sibId, {
      ...opts,
      forceNumber: true,
    });
    if (varText.trim()) bits.push(`( ${varText.trim()} )`);
  }

  const children = node.childIds;
  if (children[0]) {
    const mainId = children[0]!;
    const sideIds = children.slice(1);
    const cont = writeNode(
      game,
      mainId,
      { ...opts, forceNumber: false },
      sideIds,
    );
    if (cont) bits.push(cont);
  }

  return bits.join(' ');
}

function writeLine(
  game: ReaderGame,
  startId: string,
  opts: {
    nodes: Record<string, GameNodeAnalysis>;
    includeEvals: boolean;
    includeBest: boolean;
    forceNumber: boolean;
  },
): string {
  return writeNode(game, startId, opts, []);
}

function headersBlock(game: ReaderGame): string {
  const h = game.headers;
  const tags: Array<[string, string]> = [];
  let rawHeaders: Record<string, string> = {};
  try {
    rawHeaders =
      splitGames(game.rawPgn ?? game.source?.rawPgn ?? '')[0]?.headers ?? {};
  } catch {
    /* The navigable tree remains exportable. */
  }
  const rawTags = new Map(Object.entries(rawHeaders));
  rawTags.delete('SetUp');
  rawTags.delete('FEN');
  const push = (key: string, value: string | undefined) => {
    if (value != null && value !== '') {
      tags.push([key, value]);
      rawTags.delete(key);
    }
  };
  push('Event', h.event ?? 'AnyChess');
  push('Site', h.site ?? 'AnyChess');
  push('Date', h.date ?? '????.??.??');
  push('White', h.white ?? 'White');
  push('Black', h.black ?? 'Black');
  push('Result', h.result ?? game.result ?? '*');
  push('Opening', h.opening);
  push('ECO', h.eco);
  const nonStandardStart =
    game.initialFen &&
    game.initialFen !==
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  if (nonStandardStart) {
    push('SetUp', '1');
    push('FEN', game.initialFen);
  }

  tags.push(...rawTags);
  return tags.map(([k, v]) => `[${k} "${escapeHeader(v)}"]`).join('\n');
}

export type SerializeReaderPgnOptions = {
  includeEvals?: boolean;
  includeBest?: boolean;
  /** Analysis keyed by nodeId (must match this game's tree). */
  nodes?: Record<string, GameNodeAnalysis>;
};

/** Full PGN from the reader tree (main line + nested variations). */
export function serializeReaderGamePgn(
  game: ReaderGame,
  options: SerializeReaderPgnOptions = {},
): string {
  const includeEvals = Boolean(options.includeEvals);
  const includeBest = Boolean(options.includeBest);
  const nodes = options.nodes ?? {};
  const parts: string[] = [];
  if (game.rootIds[0])
    parts.push(
      writeNode(
        game,
        game.rootIds[0],
        {
          nodes,
          includeEvals,
          includeBest,
          forceNumber: true,
        },
        game.rootIds.slice(1),
      ),
    );
  const result = game.headers.result ?? game.result ?? '*';
  const movetext = `${parts.join(' ').replace(/\s+/g, ' ').trim()} ${result}`;
  return `${headersBlock(game)}\n\n${movetext}\n`;
}

/**
 * Enrich export — tree serialization with optional evals.
 * Preserves comments/variations; replaces generated tags only when a fresh value exists.
 */
export function exportEnrichedPgn(options: {
  game: ReaderGame;
  nodes?: Record<string, GameNodeAnalysis>;
  includeEvals?: boolean;
  includeBest?: boolean;
  /** @deprecated Prefer `game`. Kept for older call sites. */
  rawPgn?: string;
  mainLineNodeIds?: string[];
  fenBeforeByNodeId?: Record<string, string>;
}): string {
  if (options.game) {
    return serializeReaderGamePgn(options.game, {
      includeEvals: options.includeEvals ?? true,
      includeBest: options.includeBest ?? true,
      nodes: options.nodes ?? {},
    });
  }
  // Legacy fallback: return raw unchanged when no game tree.
  return options.rawPgn ?? '';
}
