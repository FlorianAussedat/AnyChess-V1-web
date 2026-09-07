/**
 * Pure helpers for compact column notation (move# | white | black + variations).
 * Kept free of React so unit tests can cover pairing / variation placement.
 */
import type { ReaderGame, ReaderNode } from './types.ts';

export type NotationMoveCell = {
  nodeId: string;
  san: string;
};

export type NotationVariationMove = {
  nodeId: string;
  san: string;
  /** e.g. "2..." when starting on black */
  prefix: string;
};

export type NotationVariationBlock = {
  key: string;
  depth: number;
  /** Main-line node whose side continuation this variation replaces. */
  afterNodeId: string;
  moves: NotationVariationMove[];
};

export type NotationColumnRow = {
  key: string;
  moveNumber: number;
  white: NotationMoveCell | null;
  black: NotationMoveCell | null;
  /** Side lines shown full-width under this ply row. */
  variations: NotationVariationBlock[];
};

function movePrefix(node: ReaderNode): string {
  if (node.color === 'white') return `${node.moveNumber}.`;
  return `${node.moveNumber}...`;
}

function collectVariationMoves(
  game: ReaderGame,
  startId: string,
  depth: number,
): NotationVariationMove[] {
  const moves: NotationVariationMove[] = [];
  let id: string | null = startId;
  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    moves.push({
      nodeId: id,
      san: node.san,
      prefix: movePrefix(node),
    });
    const children: string[] = node.childIds;
    if (children.length === 0) break;
    // Nested side lines are flattened into the same compact line for density;
    // callers can still indent by depth on the block.
    for (let i = 1; i < children.length; i += 1) {
      const nested = collectVariationMoves(game, children[i]!, depth + 1);
      for (const m of nested) moves.push(m);
    }
    id = children[0]!;
  }
  return moves;
}

function sideVariationsAfter(
  game: ReaderGame,
  node: ReaderNode,
  depth: number,
): NotationVariationBlock[] {
  const out: NotationVariationBlock[] = [];
  for (let i = 1; i < node.childIds.length; i += 1) {
    const varId = node.childIds[i]!;
    const moves = collectVariationMoves(game, varId, depth);
    if (moves.length === 0) continue;
    out.push({
      key: `${node.id}-var-${varId}`,
      depth,
      afterNodeId: node.id,
      moves,
    });
  }
  return out;
}

/**
 * Build main-line column rows (two plies per row) with side variations
 * attached under the ply where they fork.
 */
export function buildNotationColumnRows(game: ReaderGame): NotationColumnRow[] {
  const rows: NotationColumnRow[] = [];

  // Main root only; extra roots become variation blocks under an empty row 0.
  const mainRoot = game.rootIds[0];
  if (!mainRoot) {
    for (let i = 0; i < game.rootIds.length; i += 1) {
      const rootId = game.rootIds[i]!;
      const moves = collectVariationMoves(game, rootId, 1);
      if (moves.length === 0) continue;
      rows.push({
        key: `alt-root-${rootId}`,
        moveNumber: moves[0]
          ? (game.nodesById[moves[0].nodeId]?.moveNumber ?? 1)
          : 1,
        white: null,
        black: null,
        variations: [
          {
            key: `root-var-${rootId}`,
            depth: 1,
            afterNodeId: rootId,
            moves,
          },
        ],
      });
    }
    return rows;
  }

  let id: string | null = mainRoot;
  let pendingWhite: NotationMoveCell | null = null;
  let pendingMoveNumber = 1;
  let pendingVariations: NotationVariationBlock[] = [];

  const flushRow = () => {
    if (!pendingWhite && pendingVariations.length === 0) return;
    rows.push({
      key: `ply-${pendingMoveNumber}-${pendingWhite?.nodeId ?? 'empty'}`,
      moveNumber: pendingMoveNumber,
      white: pendingWhite,
      black: null,
      variations: pendingVariations,
    });
    pendingWhite = null;
    pendingVariations = [];
  };

  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;

    const cell: NotationMoveCell = { nodeId: node.id, san: node.san };
    const vars = sideVariationsAfter(game, node, 1);

    if (node.color === 'white') {
      if (pendingWhite) flushRow();
      pendingWhite = cell;
      pendingMoveNumber = node.moveNumber;
      pendingVariations = vars;
    } else if (!pendingWhite) {
      // Black starts the line (e.g. FEN mid-game) — show empty white cell.
      pendingMoveNumber = node.moveNumber;
      rows.push({
        key: `ply-${node.moveNumber}-${node.id}`,
        moveNumber: node.moveNumber,
        white: null,
        black: cell,
        variations: vars,
      });
    } else {
      rows.push({
        key: `ply-${pendingMoveNumber}-${pendingWhite.nodeId}-${node.id}`,
        moveNumber: pendingMoveNumber,
        white: pendingWhite,
        black: cell,
        variations: [...pendingVariations, ...vars],
      });
      pendingWhite = null;
      pendingVariations = [];
    }

    id = node.childIds[0] ?? null;
  }

  if (pendingWhite) flushRow();

  // Alternate roots (sibling lines from start)
  for (let i = 1; i < game.rootIds.length; i += 1) {
    const rootId = game.rootIds[i]!;
    const moves = collectVariationMoves(game, rootId, 1);
    if (moves.length === 0) continue;
    if (rows.length === 0) {
      rows.push({
        key: `alt-root-${rootId}`,
        moveNumber: 1,
        white: null,
        black: null,
        variations: [
          {
            key: `root-var-${rootId}`,
            depth: 1,
            afterNodeId: rootId,
            moves,
          },
        ],
      });
    } else {
      rows[0] = {
        ...rows[0]!,
        variations: [
          ...rows[0]!.variations,
          {
            key: `root-var-${rootId}`,
            depth: 1,
            afterNodeId: rootId,
            moves,
          },
        ],
      };
    }
  }

  return rows;
}

/** Flat index of nodeId → approximate scroll row for auto-scroll. */
export function notationScrollIndexForNode(
  rows: NotationColumnRow[],
  nodeId: string,
): number {
  let index = 0;
  for (const row of rows) {
    if (row.white?.nodeId === nodeId || row.black?.nodeId === nodeId) {
      return index;
    }
    index += 1;
    for (const v of row.variations) {
      const hit = v.moves.findIndex((m) => m.nodeId === nodeId);
      if (hit >= 0) return index;
      index += 1;
    }
  }
  return -1;
}
