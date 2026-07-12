/**
 * Build a position-keyed repertoire index from PGN, and choose moves from it.
 *
 * Walking every branch of the parsed PGN tree with chess.js gives us:
 *   - legality validation (illegal SAN is reported with context),
 *   - a canonical SAN/UCI for each move,
 *   - the resulting FEN, keyed by position (not move order) so transpositions
 *     collapse onto the same node automatically.
 *
 * Independent of Stockfish / UI: only depends on chess.js and this module's
 * own types + parser.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import { parsePgn, PgnSyntaxError, type PgnMoveNode } from './pgnParser';
import type {
  ParsedRepertoire,
  RepertoireIssue,
  RepertoireMoveChoice,
  RepertoireNode,
  RepertoireSelectionSettings,
} from './types';

export const DEFAULT_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Position key = FEN minus halfmove/fullmove counters. Two lines reaching the
 * same arrangement (even via different move orders / counters) share a key,
 * which is what makes transpositions work.
 */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

interface BuildContext {
  index: Map<string, RepertoireNode>;
  errors: RepertoireIssue[];
  warnings: RepertoireIssue[];
  gameIndex: number;
  branchCount: number;
}

function addChoice(
  ctx: BuildContext,
  beforeFen: string,
  move: Move,
  node: PgnMoveNode,
): void {
  const key = positionKey(beforeFen);
  let repNode = ctx.index.get(key);
  if (!repNode) {
    repNode = { positionKey: key, fen: beforeFen, moves: [] };
    ctx.index.set(key, repNode);
  }

  const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
  const existing = repNode.moves.find((m) => m.uci === uci);
  if (existing) {
    // Transposition onto a move we already have — merge any new comment.
    if (node.comment && !existing.comment) existing.comment = node.comment;
    for (const nag of node.nags) {
      if (!existing.nags.includes(nag)) existing.nags.push(nag);
    }
    return;
  }

  const choice: RepertoireMoveChoice = {
    san: move.san,
    uci,
    from: move.from,
    to: move.to,
    promotion: move.promotion,
    comment: node.comment,
    nags: [...node.nags],
    weight: 1,
    tags: [],
    fenAfter: move.after,
  };
  repNode.moves.push(choice);
  ctx.branchCount += 1;
}

/**
 * Recursively ingest a line starting from `startFen`. `chess` is a throwaway
 * working board for this line; variations branch off a fresh clone.
 */
function ingestLine(ctx: BuildContext, node: PgnMoveNode | null, startFen: string): void {
  const chess = new Chess(startFen);
  let cur: PgnMoveNode | null = node;

  while (cur) {
    const beforeFen = chess.fen();

    // Variations are alternatives to `cur`, so they start from `beforeFen`.
    for (const variation of cur.variations) {
      ingestLine(ctx, variation, beforeFen);
    }

    let move: Move | null = null;
    try {
      move = chess.move(cur.san) as Move;
    } catch {
      move = null;
    }

    if (!move) {
      ctx.errors.push({
        message: `Illegal or unrecognised move "${cur.san}".`,
        context: cur.san,
        game: ctx.gameIndex,
      });
      // Cannot continue this line reliably once a move fails to apply.
      return;
    }

    addChoice(ctx, beforeFen, move, cur);
    cur = cur.next;
  }
}

/** Import one or more PGN games into a position-keyed repertoire. */
export function buildRepertoire(pgn: string): ParsedRepertoire {
  const ctx: BuildContext = {
    index: new Map(),
    errors: [],
    warnings: [],
    gameIndex: 0,
    branchCount: 0,
  };
  const headers: ParsedRepertoire['headers'] = [];

  let games;
  try {
    games = parsePgn(pgn);
  } catch (err) {
    const message = err instanceof PgnSyntaxError ? err.message : String(err);
    return {
      index: ctx.index,
      headers,
      errors: [{ message }],
      warnings: [],
      branchCount: 0,
      positionCount: 0,
    };
  }

  games.forEach((game, gameIndex) => {
    ctx.gameIndex = gameIndex;
    headers.push(game.headers);

    const setupFen =
      game.headers.SetUp === '1' && game.headers.FEN ? game.headers.FEN : DEFAULT_FEN;

    // Validate the starting position before walking the line.
    try {
      // eslint-disable-next-line no-new
      new Chess(setupFen);
    } catch {
      ctx.errors.push({
        message: `Unsupported starting position (invalid FEN header).`,
        context: setupFen,
        game: gameIndex,
      });
      return;
    }

    ingestLine(ctx, game.root, setupFen);
  });

  return {
    index: ctx.index,
    headers,
    errors: ctx.errors,
    warnings: ctx.warnings,
    branchCount: ctx.branchCount,
    positionCount: ctx.index.size,
  };
}

// ── Lookup & selection ──────────────────────────────────────────────────────────

/** Is the given position covered by the repertoire? */
export function hasPosition(rep: ParsedRepertoire, fen: string): boolean {
  return rep.index.has(positionKey(fen));
}

/** All repertoire moves for a position (empty array if out of book). */
export function movesForPosition(
  rep: ParsedRepertoire,
  fen: string,
): RepertoireMoveChoice[] {
  return rep.index.get(positionKey(fen))?.moves ?? [];
}

const DEFAULT_SETTINGS: RepertoireSelectionSettings = { mode: 'uniform-random' };

/**
 * Choose a repertoire move for the current position, or null when the position
 * is not in the repertoire (i.e. control should pass back to the engine).
 */
export function chooseRepertoireMove(
  rep: ParsedRepertoire,
  fen: string,
  settings: RepertoireSelectionSettings = DEFAULT_SETTINGS,
): RepertoireMoveChoice | null {
  const moves = movesForPosition(rep, fen);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const rng = settings.rng ?? Math.random;

  switch (settings.mode) {
    case 'first':
    case 'main-line-only':
      return moves[0];

    case 'weighted-random':
      return pickWeighted(moves, (m) => Math.max(0, m.weight), rng);

    case 'rare-sidelines':
      // Invert weights so the least-weighted lines are favoured.
      return pickWeighted(moves, (m) => 1 / Math.max(1, m.weight), rng);

    case 'uniform-random':
    default:
      return moves[Math.floor(rng() * moves.length)];
  }
}

function pickWeighted(
  moves: RepertoireMoveChoice[],
  weightOf: (m: RepertoireMoveChoice) => number,
  rng: () => number,
): RepertoireMoveChoice {
  const total = moves.reduce((sum, m) => sum + weightOf(m), 0);
  if (total <= 0) return moves[Math.floor(rng() * moves.length)];
  let r = rng() * total;
  for (const m of moves) {
    r -= weightOf(m);
    if (r <= 0) return m;
  }
  return moves[moves.length - 1];
}
