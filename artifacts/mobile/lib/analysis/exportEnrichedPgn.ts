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

function evalComment(node: GameNodeAnalysis): string {
  // Standard-ish [%eval …] — mates as #N / #-N
  if (node.mate != null && node.mate !== 0) {
    return `[%eval #${node.mate}]`;
  }
  if (node.terminalOutcome === 'white') return '[%eval #1]';
  if (node.terminalOutcome === 'black') return '[%eval #-1]';
  if (node.terminalOutcome === 'draw') return '[%eval 0.00]';
  const pawns = ((node.evaluation ?? 0) / 100).toFixed(2);
  return `[%eval ${pawns}]`;
}

function stripGeneratedAnnotations(comment: string): string {
  return comment
    .replace(/\[%eval\s+[^\]]+\]/g, '')
    .replace(/\bBest:\s+\S+/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function commentForNode(
  game: ReaderGame,
  node: ReaderNode,
  analysisAfter: GameNodeAnalysis | undefined,
  analysisBefore: GameNodeAnalysis | undefined,
  includeEvals: boolean,
  includeBest: boolean,
): string | null {
  const original = stripGeneratedAnnotations(node.comment ?? '');
  const parts: string[] = [];
  if (original) parts.push(original);
  if (includeEvals && analysisAfter) {
    parts.push(evalComment(analysisAfter));
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
      node.color === 'white'
        ? `${node.moveNumber}.`
        : `${node.moveNumber}...`,
    );
  }
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
    const cont = writeNode(game, mainId, { ...opts, forceNumber: false }, sideIds);
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
  const push = (key: string, value: string | undefined) => {
    if (value != null && value !== '') tags.push([key, value]);
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
    !game.initialFen.startsWith(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR',
    );
  if (nonStandardStart) {
    push('SetUp', '1');
    push('FEN', game.initialFen);
  }

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
  for (let i = 0; i < game.rootIds.length; i += 1) {
    const rootId = game.rootIds[i]!;
    if (i === 0) {
      parts.push(
        writeLine(game, rootId, {
          nodes,
          includeEvals,
          includeBest,
          forceNumber: true,
        }),
      );
    } else {
      const varText = writeLine(game, rootId, {
        nodes,
        includeEvals,
        includeBest,
        forceNumber: true,
      });
      parts.push(`( ${varText.trim()} )`);
    }
  }
  const result = game.headers.result ?? game.result ?? '*';
  const movetext = `${parts.join(' ').replace(/\s+/g, ' ').trim()} ${result}`;
  return `${headersBlock(game)}\n\n${movetext}\n`;
}

/**
 * Enrich export — tree serialization with optional evals.
 * Preserves comments/variations; strips prior generated [%eval]/Best to avoid dupes.
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
