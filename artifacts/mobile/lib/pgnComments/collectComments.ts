import { parsePgn } from '../repertoire/pgnParser.ts';
import type { PgnMoveNode } from '../repertoire/pgnParser.ts';
import { fingerprintComment } from './fingerprint.ts';
import { detectCommentLanguage, shouldQueueEnglishComment } from './detectLanguage.ts';
import { isTechnicalOnlyComment } from './protectTokens.ts';
import type {
  PgnCommentAnchor,
  PgnCommentSource,
  PgnCommentUnit,
  PgnCommentSlot,
} from './types.ts';

function unit(
  source: PgnCommentSource,
  fileId: string,
  gameIndex: number,
  nodeId: string,
  slot: PgnCommentSlot,
  text: string | undefined,
): PgnCommentUnit | null {
  const original = text?.trim();
  if (!original) return null;
  return {
    anchor: { source, fileId, gameIndex, nodeId, slot },
    original,
    fingerprint: fingerprintComment(original),
    language: detectCommentLanguage(original),
    technicalOnly: isTechnicalOnlyComment(original),
  };
}

function walk(
  node: PgnMoveNode | null,
  source: PgnCommentSource,
  fileId: string,
  gameIndex: number,
  idSeq: { n: number },
  out: PgnCommentUnit[],
): void {
  if (!node) return;
  const siblings: PgnMoveNode[] = [node, ...node.variations];
  for (const step of siblings) {
    idSeq.n += 1;
    const nodeId = `n${idSeq.n}`;
    const before = unit(source, fileId, gameIndex, nodeId, 'before', step.commentBefore);
    const after = unit(source, fileId, gameIndex, nodeId, 'after', step.comment);
    if (before) out.push(before);
    if (after) out.push(after);
    walk(step.next, source, fileId, gameIndex, idSeq, out);
  }
}

export function collectPgnCommentUnits(
  pgnText: string,
  source: PgnCommentSource,
  fileId: string,
): PgnCommentUnit[] {
  const games = parsePgn(pgnText);
  const out: PgnCommentUnit[] = [];
  games.forEach((game, gameIndex) => {
    walk(game.root, source, fileId, gameIndex, { n: 0 }, out);
  });
  return out;
}

export function commentsToQueue(units: readonly PgnCommentUnit[]): PgnCommentUnit[] {
  return units.filter((unit) => shouldQueueEnglishComment(unit.original));
}

export function summarizeFileComments(units: readonly PgnCommentUnit[]): {
  total: number;
  english: number;
  french: number;
  technical: number;
} {
  return {
    total: units.length,
    english: units.filter((u) => u.language === 'en').length,
    french: units.filter((u) => u.language === 'fr').length,
    technical: units.filter((u) => u.technicalOnly).length,
  };
}

export function commentAnchorKey(anchor: PgnCommentAnchor): string {
  return `${anchor.source}:${anchor.fileId}:${anchor.gameIndex}:${anchor.nodeId}:${anchor.slot}`;
}
