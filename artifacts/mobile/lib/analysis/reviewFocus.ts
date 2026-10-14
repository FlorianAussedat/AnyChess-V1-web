/**
 * Selected-move review vs the live position.
 *
 * Replay reads the position BEFORE the selected move (the side that played it).
 * Free analysis reads the position currently on the board (the side to move).
 * Scores stay White-centric; this module never flips them again.
 */
import type { EngineLine, PositionAnalysis } from './types.ts';
import { isEvalPresent, type WhiteEval } from './formatEval.ts';
import { sideToMoveFromFen } from './scoreWhite.ts';
import { uciToSan } from './uciToSan.ts';

export type BoardArrow = { from: string; to: string };

export type LegalMove = {
  uci: string;
  san: string;
  from: string;
  to: string;
};

export type Suggestion = {
  san: string;
  uci: string;
  from: string;
  to: string;
  evaluation: number | null;
  mate: number | null;
};

export function positionCore(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function sameChessPosition(a: string, b: string): boolean {
  return positionCore(a) === positionCore(b);
}

export function legalUci(
  fen: string,
  uci: string | null | undefined,
): LegalMove | null {
  if (!uci || uci.length < 4) return null;
  const san = uciToSan(fen, uci);
  if (!san) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4]!.toLowerCase() : '';
  return { uci: `${from}${to}${promotion}`, san, from, to };
}

function lineUci(line: EngineLine): string | null {
  return line.bestMove ?? line.pv[0] ?? null;
}

function lineHasScore(line: EngineLine): boolean {
  if (line.mate != null && line.mate !== 0) return true;
  return line.scoreCp != null && Number.isFinite(line.scoreCp);
}

/** Legal candidate moves. Lines without a legal first move are dropped. */
export function legalSuggestions(
  fen: string,
  lines: EngineLine[] | undefined,
  options?: { excludeUci?: string | null; limit?: number },
): Suggestion[] {
  const limit = options?.limit ?? 3;
  const excluded = options?.excludeUci
    ? (legalUci(fen, options.excludeUci)?.uci ?? null)
    : null;
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const line of lines ?? []) {
    if (!lineHasScore(line)) continue;
    const move = legalUci(fen, lineUci(line));
    if (!move || seen.has(move.uci)) continue;
    if (excluded && move.uci === excluded) continue;
    seen.add(move.uci);
    out.push({
      san: move.san,
      uci: move.uci,
      from: move.from,
      to: move.to,
      evaluation: line.mate != null ? null : line.scoreCp,
      mate: line.mate,
    });
    if (out.length >= limit) break;
  }
  return out;
}

function trustedAnalysis(
  fen: string,
  analysis: PositionAnalysis | null | undefined,
): PositionAnalysis | null {
  if (!analysis || analysis.evalPerspective !== 'white') return null;
  if (!sameChessPosition(analysis.fen, fen)) return null;
  return analysis;
}

/**
 * One arrow: the first legal best move on `fen`.
 * Nothing is drawn when the analysis is missing, stale, terminal, or illegal.
 */
export function singleBestArrow(
  fen: string,
  analysis: PositionAnalysis | null | undefined,
): BoardArrow | null {
  const trusted = trustedAnalysis(fen, analysis);
  if (!trusted || trusted.terminalOutcome) return null;
  const primary = legalUci(fen, trusted.bestMove);
  if (primary) return { from: primary.from, to: primary.to };
  const first = trusted.lines[0];
  if (!first) return null;
  const fallback = legalUci(fen, lineUci(first));
  if (!fallback) return null;
  return { from: fallback.from, to: fallback.to };
}

function asEval(
  analysis: PositionAnalysis | null,
): WhiteEval | null {
  if (!analysis) return null;
  const value: WhiteEval = {
    cp: analysis.evaluation,
    mate: analysis.mate,
    terminalOutcome: analysis.terminalOutcome,
  };
  return isEvalPresent(value) ? value : null;
}

function bestLegalMove(
  fen: string,
  analysis: PositionAnalysis | null,
): LegalMove | null {
  if (!analysis) return null;
  const fromField = legalUci(fen, analysis.bestMove);
  if (fromField) return fromField;
  const first = analysis.lines[0];
  if (!first) return null;
  return legalUci(fen, lineUci(first));
}

export type MoveReview = {
  fenBefore: string;
  fenAfter: string;
  /** Side that played the selected move (side to move on fenBefore). */
  side: 'w' | 'b';
  playedSan: string;
  playedUci: string | null;
  bestSan: string | null;
  bestUci: string | null;
  before: WhiteEval | null;
  after: WhiteEval | null;
  /** Other legal options, never a repeat of the best move. */
  possibilities: Suggestion[];
  arrow: BoardArrow | null;
  beforeTerminal: boolean;
  afterTerminal: boolean;
};

export function buildSelectedMoveReview(input: {
  fenBefore: string;
  fenAfter: string;
  playedSan: string;
  playedUci: string | null;
  before: PositionAnalysis | null;
  after: PositionAnalysis | null;
}): MoveReview {
  const before = trustedAnalysis(input.fenBefore, input.before);
  const after = trustedAnalysis(input.fenAfter, input.after);
  const best = bestLegalMove(input.fenBefore, before);
  return {
    fenBefore: input.fenBefore,
    fenAfter: input.fenAfter,
    side: sideToMoveFromFen(input.fenBefore),
    playedSan: input.playedSan,
    playedUci: input.playedUci,
    bestSan: best?.san ?? null,
    bestUci: best?.uci ?? null,
    before: asEval(before),
    after: asEval(after),
    possibilities: legalSuggestions(input.fenBefore, before?.lines, {
      excludeUci: best?.uci ?? null,
      limit: 3,
    }),
    arrow: singleBestArrow(input.fenBefore, before),
    beforeTerminal: Boolean(before?.terminalOutcome),
    afterTerminal: Boolean(after?.terminalOutcome),
  };
}

export type LiveFocus = {
  fen: string;
  side: 'w' | 'b';
  evaluation: WhiteEval | null;
  /** Up to three legal moves for the side to move, best first. */
  possibilities: Suggestion[];
  arrow: BoardArrow | null;
  terminal: boolean;
};

export function buildLiveFocus(
  fen: string,
  analysis: PositionAnalysis | null,
): LiveFocus {
  const trusted = trustedAnalysis(fen, analysis);
  return {
    fen,
    side: sideToMoveFromFen(fen),
    evaluation: asEval(trusted),
    possibilities: legalSuggestions(fen, trusted?.lines, { limit: 3 }),
    arrow: singleBestArrow(fen, trusted),
    terminal: Boolean(trusted?.terminalOutcome),
  };
}

export type BoardPresentation = {
  fen: string;
  preview: boolean;
  previewSan: string | null;
};

/**
 * Replay with the arrow control on shows the position BEFORE the selected
 * move. Turning it off restores the position after that move. The selected
 * node is never changed here.
 */
export function resolveBoardPresentation(input: {
  mode: 'replay' | 'live';
  arrowsEnabled: boolean;
  liveFen: string;
  selected: { fenBefore: string; fenAfter: string; san: string } | null;
}): BoardPresentation {
  if (input.mode === 'replay' && input.arrowsEnabled && input.selected) {
    return {
      fen: input.selected.fenBefore,
      preview: true,
      previewSan: input.selected.san,
    };
  }
  const fen =
    input.mode === 'replay' && input.selected
      ? input.selected.fenAfter
      : input.liveFen;
  return { fen, preview: false, previewSan: null };
}
