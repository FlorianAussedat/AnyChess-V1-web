/**
 * Recover PGN comments / NAGs for the line actually played in Opening Mode.
 *
 * The repertoire DAG is keyed by position and merges comments on the same UCI,
 * which mixes branches that share a prefix or transpose. Analyzer export must
 * instead walk the original PGN tree, matching the played SAN sequence among
 * `[node, ...node.variations]` then `node.next`, so annotations come from the
 * branch that was followed — never from a sibling variation.
 */
import { parsePgn, type PgnMoveNode } from './pgnParser.ts';
import { exportGamePgn, type PgnExportHeaders } from '../pgn/PgnExporter.ts';
import type { Move } from 'chess.js';

export type PlyAnnotation = {
  /** 0-based ply in the played game. */
  ply: number;
  comment?: string;
  nags?: string[];
};

function normalizeSan(san: string): string {
  return san
    .trim()
    .replace(/[+#]+$/g, '')
    .replace(/0-0-0/g, 'O-O-O')
    .replace(/0-0/g, 'O-O');
}

/** Next-ply candidates: this move and its PGN alternatives (same ply). */
function candidatesFor(node: PgnMoveNode | null): PgnMoveNode[] {
  if (!node) return [];
  return [node, ...node.variations];
}

function findPlayed(
  candidates: PgnMoveNode[],
  san: string,
): PgnMoveNode | undefined {
  const want = normalizeSan(san);
  return candidates.find((n) => normalizeSan(n.san) === want);
}

/** Walk one game tree along the played SAN path; stop at the first mismatch. */
export function matchPlayedLine(
  root: PgnMoveNode | null,
  playedSans: readonly string[],
): PgnMoveNode[] {
  const matched: PgnMoveNode[] = [];
  let candidates = candidatesFor(root);
  for (const san of playedSans) {
    const found = findPlayed(candidates, san);
    if (!found) break;
    matched.push(found);
    candidates = candidatesFor(found.next);
  }
  return matched;
}

function annotationWeight(nodes: readonly PgnMoveNode[]): number {
  let n = 0;
  for (const node of nodes) {
    if (node.comment && node.comment.trim()) n += 1;
    n += node.nags.length;
  }
  return n;
}

function toPlyAnnotations(nodes: readonly PgnMoveNode[]): PlyAnnotation[] {
  const out: PlyAnnotation[] = [];
  nodes.forEach((node, ply) => {
    const comment = node.comment?.trim();
    const nags = node.nags.filter((g) => g.length > 0);
    if (!comment && nags.length === 0) return;
    out.push({
      ply,
      comment: comment || undefined,
      nags: nags.length > 0 ? [...nags] : undefined,
    });
  });
  return out;
}

/**
 * Pick the PGN game/branch that best matches `playedSans` and return comments
 * / NAGs for those plies only. Unplayed variations are ignored. A mismatch
 * stops the walk so a later coincidental SAN cannot steal another branch's
 * annotations.
 */
export function annotationsForPlayedLine(
  sourcePgn: string | null | undefined,
  playedSans: readonly string[],
): PlyAnnotation[] {
  const text = typeof sourcePgn === 'string' ? sourcePgn.trim() : '';
  if (!text || playedSans.length === 0) return [];

  let games;
  try {
    games = parsePgn(text);
  } catch {
    return [];
  }

  let best: PgnMoveNode[] = [];
  let bestWeight = -1;
  for (const game of games) {
    const matched = matchPlayedLine(game.root, playedSans);
    const weight = annotationWeight(matched);
    if (
      matched.length > best.length ||
      (matched.length === best.length && weight > bestWeight)
    ) {
      best = matched;
      bestWeight = weight;
    }
  }

  return toPlyAnnotations(best);
}

/**
 * Serialize a played opening game for the classic analyzer, copying comments
 * and NAGs from the source PGN branch that matches the played SAN list.
 */
export function exportOpeningPlayedPgn(options: {
  headers: PgnExportHeaders;
  moves: Move[];
  sourcePgn?: string | null;
  commentAfterPly?: { ply: number; text: string };
}): string {
  const sans = options.moves.map((m) => m.san);
  return exportGamePgn({
    headers: options.headers,
    moves: options.moves,
    plyAnnotations: annotationsForPlayedLine(options.sourcePgn, sans),
    commentAfterPly: options.commentAfterPly,
  });
}

