/**
 * Order nodes for background game analysis.
 *
 * Priority:
 * 1. Current position (handled separately by analyzeCurrentPosition)
 * 2. Remaining nodes forward on the active line
 * 3. Rest of the main line from the start
 * 4. Then recursive variants (after main line)
 */
import type { ReaderGame } from '@/lib/gameReader';
import type { AnalyzeNodeSpec } from './AnalysisController.ts';
import {
  collectMainLineNodes,
  type MainLineNodeRef,
} from './mainLineNodes.ts';

export function orderNodesForBackgroundAnalysis(input: {
  mainLine: AnalyzeNodeSpec[];
  activeLine: AnalyzeNodeSpec[];
  currentFen: string | null;
  /** Appended after main line (variants). */
  variantNodes?: AnalyzeNodeSpec[];
}): AnalyzeNodeSpec[] {
  const { mainLine, activeLine, currentFen, variantNodes = [] } = input;
  const ordered: AnalyzeNodeSpec[] = [];
  const seen = new Set<string>();

  const push = (n: AnalyzeNodeSpec) => {
    if (seen.has(n.nodeId)) return;
    seen.add(n.nodeId);
    ordered.push(n);
  };

  let activeIdx = -1;
  if (currentFen) {
    activeIdx = activeLine.findIndex((n) => n.fen === currentFen);
  }

  if (activeIdx >= 0) {
    for (let i = activeIdx + 1; i < activeLine.length; i += 1) {
      push(activeLine[i]!);
    }
  } else {
    for (const n of activeLine) push(n);
  }

  for (const n of mainLine) push(n);
  for (const n of variantNodes) push(n);

  return ordered;
}

/**
 * Collect side-variation nodes after the main line is done.
 * Order: first-level forks along the main spine, each walked depth-first
 * (including nested sub-variations) before the next fork.
 */
export function collectVariantNodesForAnalysis(
  game: ReaderGame,
): AnalyzeNodeSpec[] {
  const main = collectMainLineNodes(game);
  const mainIds = new Set(main.map((n) => n.nodeId));
  const ordered: AnalyzeNodeSpec[] = [];
  const seen = new Set<string>();

  const pushSubtree = (rootId: string) => {
    const stack = [rootId];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id) || mainIds.has(id)) continue;
      seen.add(id);
      const node = game.nodesById[id];
      if (!node) continue;
      ordered.push({ nodeId: node.id, fen: node.fenAfter });
      // Push children reversed so first child is processed first (DFS-ish).
      for (let i = node.childIds.length - 1; i >= 0; i -= 1) {
        stack.push(node.childIds[i]!);
      }
    }
  };

  // Alternate roots (not main root).
  for (let i = 1; i < game.rootIds.length; i += 1) {
    pushSubtree(game.rootIds[i]!);
  }

  // Side children along the main spine (childIds[0] is main continuation).
  const spine: MainLineNodeRef[] = main;
  // Also consider forks from start: children of root beyond main.
  // Handled above via rootIds.

  for (const step of spine) {
    const node = game.nodesById[step.nodeId];
    if (!node) continue;
    for (let i = 1; i < node.childIds.length; i += 1) {
      pushSubtree(node.childIds[i]!);
    }
  }

  return ordered;
}
