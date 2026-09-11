/**
 * Order nodes for background game analysis:
 * 1. Current position (handled separately by analyzeCurrentPosition)
 * 2. Remaining nodes forward on the active line
 * 3. Then the rest of the main line from the start (skipping already queued)
 *
 * Current-position analysis always preempts this queue inside AnalysisController.
 */
import type { AnalyzeNodeSpec } from './AnalysisController.ts';

export function orderNodesForBackgroundAnalysis(input: {
  mainLine: AnalyzeNodeSpec[];
  activeLine: AnalyzeNodeSpec[];
  currentFen: string | null;
}): AnalyzeNodeSpec[] {
  const { mainLine, activeLine, currentFen } = input;
  const ordered: AnalyzeNodeSpec[] = [];
  const seen = new Set<string>();

  const push = (n: AnalyzeNodeSpec) => {
    if (seen.has(n.nodeId)) return;
    seen.add(n.nodeId);
    ordered.push(n);
  };

  // Find index of current FEN on the active line (prefer first match).
  let activeIdx = -1;
  if (currentFen) {
    activeIdx = activeLine.findIndex((n) => n.fen === currentFen);
  }

  // Forward from current (exclusive of current — already analyzed as position).
  if (activeIdx >= 0) {
    for (let i = activeIdx + 1; i < activeLine.length; i += 1) {
      push(activeLine[i]!);
    }
  } else {
    // Unknown cursor — still prefer walking the active line first.
    for (const n of activeLine) push(n);
  }

  // Fill remaining main-line nodes (from start).
  for (const n of mainLine) push(n);

  return ordered;
}
