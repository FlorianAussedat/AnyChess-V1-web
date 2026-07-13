/**
 * Analyse a repertoire deviation without touching the UI or game state.
 *
 * Given the position BEFORE the player's off-book move, lists every theoretical
 * alternative at that node and builds one illustrative continuation (depth-
 * limited) by repeatedly picking the first available book move.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import {
  chooseRepertoireMove,
  movesForPosition,
  type ParsedRepertoire,
  type RepertoireMoveChoice,
} from '@/lib/repertoire';
import { formatNumberedSan } from '@/lib/moves/formatNumberedSan';

export interface TheoryContinuationStep {
  ply: number;
  san: string;
  numbered: string;
}

export interface DeviationAnalysis {
  /** Player's off-book move, numbered. */
  playedNumbered: string;
  playedSan: string;
  /** All distinct repertoire moves available at the deviation position. */
  availableMoves: Array<{ san: string; numbered: string; uci: string }>;
  /** One sample continuation starting from a theoretical alternative. */
  continuation: TheoryContinuationStep[];
  /** SAN of the first move of the proposed continuation, if any. */
  continuationRootSan: string | null;
  /**
   * Best-effort repertoire branch labels (PGN Event / Opening headers).
   * Present when the imported files carry useful headers.
   */
  sourceHints: string[];
}

const MAX_CONTINUATION_PLIES = 10;

export function analyzeDeviation(
  repertoire: ParsedRepertoire,
  beforeFen: string,
  played: Move,
  deviationPly: number,
): DeviationAnalysis {
  const choices = movesForPosition(repertoire, beforeFen);
  const availableMoves = choices.map((c) => ({
    san: c.san,
    numbered: formatNumberedSan(deviationPly, c.san),
    uci: c.uci,
  }));

  // Prefer a "main" first choice as continuation root; fall back to first.
  const root: RepertoireMoveChoice | null = choices[0] ?? null;
  const continuation: TheoryContinuationStep[] = [];
  let continuationRootSan: string | null = null;

  if (root) {
    continuationRootSan = root.san;
    const board = new Chess(beforeFen);
    try {
      board.move({
        from: root.from,
        to: root.to,
        promotion: root.promotion || 'q',
      });
      continuation.push({
        ply: deviationPly,
        san: root.san,
        numbered: formatNumberedSan(deviationPly, root.san),
      });

      let ply = deviationPly + 1;
      for (let i = 0; i < MAX_CONTINUATION_PLIES - 1; i++) {
        const next = chooseRepertoireMove(repertoire, board.fen(), { mode: 'first' });
        if (!next) break;
        const moved = board.move({
          from: next.from,
          to: next.to,
          promotion: next.promotion || 'q',
        }) as Move;
        continuation.push({
          ply,
          san: moved.san,
          numbered: formatNumberedSan(ply, moved.san),
        });
        ply += 1;
      }
    } catch {
      /* ignore illegal continuation build */
    }
  }

  const sourceHints = uniqueSourceHints(repertoire);

  return {
    playedNumbered: formatNumberedSan(deviationPly, played.san),
    playedSan: played.san,
    availableMoves,
    continuation,
    continuationRootSan,
    sourceHints,
  };
}

function uniqueSourceHints(repertoire: ParsedRepertoire): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of repertoire.headers) {
    const label = (h.Source || h.Event || h.Opening || h.White || '').trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= 4) break;
  }
  return out;
}
