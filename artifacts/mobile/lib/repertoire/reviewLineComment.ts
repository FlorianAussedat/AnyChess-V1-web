/**
 * Look up the PGN comment that belongs to a move on the reviewed variation.
 * Walks the original PGN tree along `lineSans` so a sibling branch cannot leak.
 */
import { preferencesStore } from '../preferences/PreferencesStore.ts';
import { resolvePgnComment } from '../pgnComments/resolveComment.ts';
import type { PgnCommentAnchor } from '../pgnComments/types.ts';
import { parsePgn, type PgnMoveNode } from './pgnParser.ts';
import { matchPlayedLine } from './playedLineAnnotations.ts';

export type ReviewedMoveComment = {
  comment: string;
  gameIndex: number;
  nodeId: string;
};

function annotationWeight(nodes: readonly PgnMoveNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.comment?.trim()) n += 1;
    n += node.nags.length;
  }
  return n;
}

function walkNodeIds(
  node: PgnMoveNode | null,
  idSeq: { n: number },
  target: PgnMoveNode,
): string | null {
  if (!node) return null;
  const siblings: PgnMoveNode[] = [node, ...node.variations];
  for (const step of siblings) {
    idSeq.n += 1;
    const nodeId = `n${idSeq.n}`;
    if (step === target) return nodeId;
    const nested = walkNodeIds(step.next, idSeq, target);
    if (nested) return nested;
  }
  return null;
}

function bestMatchedLine(
  sourcePgn: string,
  lineSans: readonly string[],
): { gameIndex: number; nodes: PgnMoveNode[]; root: PgnMoveNode | null } | null {
  const text = sourcePgn.trim();
  if (!text || lineSans.length === 0) return null;

  let games;
  try {
    games = parsePgn(text);
  } catch {
    return null;
  }

  let best: { gameIndex: number; nodes: PgnMoveNode[]; root: PgnMoveNode | null } | null =
    null;
  let bestWeight = -1;
  games.forEach((game, gameIndex) => {
    const matched = matchPlayedLine(game.root, lineSans);
    const weight = annotationWeight(matched);
    if (
      !best ||
      matched.length > best.nodes.length ||
      (matched.length === best.nodes.length && weight > bestWeight)
    ) {
      best = { gameIndex, nodes: matched, root: game.root };
      bestWeight = weight;
    }
  });
  return best;
}

export function commentOnReviewedLinePly(
  sourcePgn: string | null | undefined,
  lineSans: readonly string[],
  ply: number,
): ReviewedMoveComment | null {
  const text = typeof sourcePgn === 'string' ? sourcePgn : '';
  if (!text.trim() || ply < 0 || ply >= lineSans.length) return null;

  const best = bestMatchedLine(text, lineSans);
  if (!best || best.nodes.length <= ply) return null;
  const node = best.nodes[ply];
  const comment = node?.comment?.trim();
  if (!node || !comment) return null;

  const nodeId = walkNodeIds(best.root, { n: 0 }, node) ?? `n${ply + 1}`;
  return { comment, gameIndex: best.gameIndex, nodeId };
}

export function commentOnReviewedLineLastMove(
  sourcePgn: string | null | undefined,
  lineSans: readonly string[],
): ReviewedMoveComment | null {
  if (lineSans.length === 0) return null;
  return commentOnReviewedLinePly(sourcePgn, lineSans, lineSans.length - 1);
}

export function displayReviewedMoveComment(
  hit: ReviewedMoveComment,
  fileId: string | null | undefined,
): string {
  if (!fileId) return hit.comment;
  const language = preferencesStore.getPreferences().language;
  const anchor: PgnCommentAnchor = {
    source: 'repertoire',
    fileId,
    gameIndex: hit.gameIndex,
    nodeId: hit.nodeId,
    slot: 'after',
  };
  return resolvePgnComment(anchor, hit.comment, language).text;
}

export function resolvedCommentOnReviewedLinePly(
  sourcePgn: string | null | undefined,
  lineSans: readonly string[],
  ply: number,
  fileId: string | null | undefined,
): string | null {
  const hit = commentOnReviewedLinePly(sourcePgn, lineSans, ply);
  if (!hit) return null;
  return displayReviewedMoveComment(hit, fileId);
}

export function resolvedFinalLineComment(
  sourcePgn: string | null | undefined,
  lineSans: readonly string[],
  fileId: string | null | undefined,
): string | null {
  const hit = commentOnReviewedLineLastMove(sourcePgn, lineSans);
  if (!hit) return null;
  return displayReviewedMoveComment(hit, fileId);
}
