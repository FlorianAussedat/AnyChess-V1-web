/**
 * Pure helpers for compact column notation with recursive nested variations.
 * Main line: move# | white | black.
 * Side lines: full-width blocks under the fork, recursively nested.
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

/**
 * A variation block may contain nested child variation blocks after any move
 * that itself has side continuations — depth is arbitrary.
 */
export type NotationVariationBlock = {
  key: string;
  depth: number;
  /** Main-line (or parent-line) node whose side continuation this replaces. */
  afterNodeId: string;
  /** Primary continuation of this variation (childIds[0] walk). */
  moves: NotationVariationMove[];
  /** Nested variations forked from moves in this block. */
  nested: NotationVariationBlock[];
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

/**
 * Walk one variation starting at `startId`, collecting its main continuation
 * and recursively capturing nested side lines as `nested` blocks.
 */
export function collectVariationBlock(
  game: ReaderGame,
  startId: string,
  depth: number,
  afterNodeId: string,
): NotationVariationBlock | null {
  const moves: NotationVariationMove[] = [];
  const nested: NotationVariationBlock[] = [];
  let id: string | null = startId;

  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    moves.push({
      nodeId: id,
      san: node.san,
      prefix: movePrefix(node),
    });

    // Nested side lines fork AFTER this move (alternatives to childIds[0]).
    for (let i = 1; i < node.childIds.length; i += 1) {
      const childVar = collectVariationBlock(
        game,
        node.childIds[i]!,
        depth + 1,
        node.id,
      );
      if (childVar) nested.push(childVar);
    }

    id = node.childIds[0] ?? null;
  }

  if (moves.length === 0) return null;
  return {
    key: `${afterNodeId}-var-${startId}`,
    depth,
    afterNodeId,
    moves,
    nested,
  };
}

function sideVariationsAfter(
  game: ReaderGame,
  node: ReaderNode,
  depth: number,
): NotationVariationBlock[] {
  const out: NotationVariationBlock[] = [];
  for (let i = 1; i < node.childIds.length; i += 1) {
    const block = collectVariationBlock(
      game,
      node.childIds[i]!,
      depth,
      node.id,
    );
    if (block) out.push(block);
  }
  return out;
}

/**
 * Build main-line column rows (two plies per row) with recursive side variations
 * attached under the ply where they fork.
 */
export function buildNotationColumnRows(game: ReaderGame): NotationColumnRow[] {
  const rows: NotationColumnRow[] = [];

  const mainRoot = game.rootIds[0];
  if (!mainRoot) {
    for (let i = 0; i < game.rootIds.length; i += 1) {
      const rootId = game.rootIds[i]!;
      const block = collectVariationBlock(game, rootId, 1, rootId);
      if (!block) continue;
      rows.push({
        key: `alt-root-${rootId}`,
        moveNumber: game.nodesById[rootId]?.moveNumber ?? 1,
        white: null,
        black: null,
        variations: [block],
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

  for (let i = 1; i < game.rootIds.length; i += 1) {
    const rootId = game.rootIds[i]!;
    const block = collectVariationBlock(game, rootId, 1, rootId);
    if (!block) continue;
    if (rows.length === 0) {
      rows.push({
        key: `alt-root-${rootId}`,
        moveNumber: 1,
        white: null,
        black: null,
        variations: [block],
      });
    } else {
      rows[0] = {
        ...rows[0]!,
        variations: [...rows[0]!.variations, block],
      };
    }
  }

  return rows;
}

function variationContainsNode(
  block: NotationVariationBlock,
  nodeId: string,
): boolean {
  if (block.moves.some((m) => m.nodeId === nodeId)) return true;
  return block.nested.some((n) => variationContainsNode(n, nodeId));
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
      if (variationContainsNode(v, nodeId)) return index;
      index += 1;
    }
  }
  return -1;
}

/** Whether a variation block (or nested descendant) contains the active node. */
export function variationBlockIsActive(
  block: NotationVariationBlock,
  activeLineNodeIds: string[],
): boolean {
  const set = new Set(activeLineNodeIds);
  if (block.moves.some((m) => set.has(m.nodeId))) return true;
  return block.nested.some((n) => variationBlockIsActive(n, activeLineNodeIds));
}
