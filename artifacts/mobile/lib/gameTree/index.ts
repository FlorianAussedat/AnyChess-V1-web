/**
 * Shared PGN game-tree helpers for Lecteur/AnyLyseur workspace and openings.
 *
 * Source of truth for navigable trees: `ReaderGame` (nodesById / childIds).
 * Openings may still build a position-keyed repertoire index for training,
 * but line enumeration MUST use this recursive walk — never a flat main-line
 * projection that drops nested variations.
 */
import type { ReaderGame, ReaderNode } from '../gameReader/types.ts';

export type GameTreeLine = {
  /** Node ids from root move to leaf (exclusive of start position). */
  nodeIds: string[];
  /** English SAN sequence along the path. */
  sans: string[];
  /** FEN after each move (same length as sans). */
  fensAfter: string[];
  /** FEN before the first move. */
  startFen: string;
};

export type GameTreeStats = {
  nodeCount: number;
  leafCount: number;
  lineCount: number;
  maxDepth: number;
};

/** Count direct children (forks) at a node. */
export function childCount(game: ReaderGame, nodeId: string): number {
  return game.nodesById[nodeId]?.childIds.length ?? 0;
}

export function isLeafNode(game: ReaderGame, nodeId: string): boolean {
  const node = game.nodesById[nodeId];
  return Boolean(node && node.childIds.length === 0);
}

/**
 * Recursively collect every root→leaf path in the tree.
 * Depth is unbounded — nested variations are full first-class paths.
 */
export function getAllRootToLeafLines(game: ReaderGame): GameTreeLine[] {
  const lines: GameTreeLine[] = [];

  function walk(
    nodeId: string,
    nodeIds: string[],
    sans: string[],
    fensAfter: string[],
  ): void {
    const node = game.nodesById[nodeId];
    if (!node) return;
    const nextIds = [...nodeIds, nodeId];
    const nextSans = [...sans, node.san];
    const nextFens = [...fensAfter, node.fenAfter];

    if (node.childIds.length === 0) {
      lines.push({
        nodeIds: nextIds,
        sans: nextSans,
        fensAfter: nextFens,
        startFen: game.initialFen,
      });
      return;
    }

    for (const childId of node.childIds) {
      walk(childId, nextIds, nextSans, nextFens);
    }
  }

  if (game.rootIds.length === 0) {
    return [];
  }

  for (const rootId of game.rootIds) {
    walk(rootId, [], [], []);
  }

  return lines;
}

/** All legal repertoire children (SAN) at a given FEN after position. */
export function getChildSansAtFen(game: ReaderGame, fen: string): string[] {
  const sans: string[] = [];
  const seen = new Set<string>();

  // Start position: children are roots.
  if (fen === game.initialFen) {
    for (const id of game.rootIds) {
      const n = game.nodesById[id];
      if (n && !seen.has(n.san)) {
        seen.add(n.san);
        sans.push(n.san);
      }
    }
    return sans;
  }

  for (const node of Object.values(game.nodesById)) {
    if (node.fenAfter !== fen) continue;
    for (const childId of node.childIds) {
      const child = game.nodesById[childId];
      if (child && !seen.has(child.san)) {
        seen.add(child.san);
        sans.push(child.san);
      }
    }
  }
  return sans;
}

export function getGameTreeStats(game: ReaderGame): GameTreeStats {
  const nodeCount = Object.keys(game.nodesById).length;
  const lines = getAllRootToLeafLines(game);
  let maxDepth = 0;
  for (const line of lines) {
    if (line.nodeIds.length > maxDepth) maxDepth = line.nodeIds.length;
  }
  let leafCount = 0;
  for (const id of Object.keys(game.nodesById)) {
    if (isLeafNode(game, id)) leafCount += 1;
  }
  return {
    nodeCount,
    leafCount,
    lineCount: lines.length,
    maxDepth,
  };
}

/**
 * Structural fingerprint for round-trip comparison (order-insensitive forks,
 * order-sensitive main continuations via childIds order).
 */
export function gameTreeFingerprint(game: ReaderGame): string {
  const parts: string[] = [`start:${game.initialFen}`];

  function walk(nodeId: string, path: string): void {
    const node = game.nodesById[nodeId];
    if (!node) return;
    const here = `${path}/${node.san}`;
    parts.push(
      `${here}|before:${node.fenBefore}|after:${node.fenAfter}|kids:${node.childIds.length}`,
    );
    for (const childId of node.childIds) {
      walk(childId, here);
    }
  }

  for (const rootId of game.rootIds) {
    walk(rootId, '');
  }

  return parts.sort().join('\n');
}

export type { ReaderGame, ReaderNode };
