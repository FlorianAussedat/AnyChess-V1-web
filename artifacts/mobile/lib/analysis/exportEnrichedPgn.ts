/**
 * Enrich PGN with [%eval …] without destroying original comments/variations.
 */
import type { GameNodeAnalysis } from './types.ts';
import { uciToSan } from './uciToSan.ts';

function evalTag(node: GameNodeAnalysis): string {
  if (node.mate != null && node.mate !== 0) {
    return `[%eval #${node.mate}]`;
  }
  const pawns = ((node.evaluation ?? 0) / 100).toFixed(2);
  return `[%eval ${pawns}]`;
}

function annotationFor(
  node: GameNodeAnalysis,
  fenBefore: string | undefined,
): string {
  const parts = [evalTag(node)];
  if (node.bestMove && fenBefore) {
    const san = uciToSan(fenBefore, node.bestMove);
    if (san) parts.push(`Best: ${san}`);
  }
  return parts.join(' ');
}

export function exportEnrichedPgn(options: {
  rawPgn: string;
  nodes: Record<string, GameNodeAnalysis>;
  mainLineNodeIds: string[];
  fenBeforeByNodeId?: Record<string, string>;
}): string {
  const { rawPgn, nodes, mainLineNodeIds, fenBeforeByNodeId } = options;
  if (mainLineNodeIds.length === 0) return rawPgn;

  const headerEnd = rawPgn.indexOf('\n\n');
  const headers = headerEnd >= 0 ? rawPgn.slice(0, headerEnd + 2) : '';
  let movetext = headerEnd >= 0 ? rawPgn.slice(headerEnd + 2) : rawPgn;

  let nodeIndex = 0;
  movetext = movetext.replace(
    /(\b(?:[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|O-O-O|O-O)\b)(\s*\{[^}]*\})?/g,
    (full, san: string, existingComment?: string) => {
      if (nodeIndex >= mainLineNodeIds.length) return full;
      const nodeId = mainLineNodeIds[nodeIndex]!;
      nodeIndex += 1;
      const analysis = nodes[nodeId];
      if (!analysis) return full;
      const anno = annotationFor(analysis, fenBeforeByNodeId?.[nodeId]);
      if (existingComment) {
        const inner = existingComment.trim().slice(1, -1).trim();
        if (/\[%eval\b/.test(inner)) return full;
        const merged = inner.length > 0 ? `${inner} ${anno}` : anno;
        return `${san} { ${merged} }`;
      }
      return `${san} { ${anno} }`;
    },
  );

  return headers + movetext;
}
