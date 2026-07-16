/**
 * Sample linear repertoire paths and mid-line starting points.
 * Pure chess logic — no UI.
 */
import { Chess } from 'chess.js';
import {
  DEFAULT_FEN,
  chooseRepertoireMove,
  movesForPosition,
  positionKey,
} from '../repertoire/repertoireTree.ts';
import type { ParsedRepertoire, RepertoireMoveChoice } from '../repertoire/types.ts';
import type { ContinueLinePath } from './types.ts';

export type PathSampleOptions = {
  startFen?: string;
  rng?: () => number;
  /** Avoid immediately reusing these path ids. */
  recentPathIds?: string[];
  maxAttempts?: number;
};

function pathId(sans: string[]): string {
  return sans.join(' ');
}

/**
 * Walk the repertoire with uniform-random edge choice until a leaf.
 */
export function sampleRandomPath(
  rep: ParsedRepertoire,
  options: PathSampleOptions = {},
): ContinueLinePath | null {
  const startFen = options.startFen ?? DEFAULT_FEN;
  const rng = options.rng ?? Math.random;
  const recent = new Set(options.recentPathIds ?? []);
  const maxAttempts = options.maxAttempts ?? 12;

  let best: ContinueLinePath | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Diversify stuck RNGs across attempts so recent-path avoidance can explore forks.
    const attemptRng = () => (rng() + attempt * 0.6180339887) % 1;
    const chess = new Chess(startFen);
    const sans: string[] = [];
    const fensBefore: string[] = [];
    const choices: RepertoireMoveChoice[] = [];
    const seen = new Set<string>();

    while (true) {
      const fen = chess.fen();
      const key = positionKey(fen);
      if (seen.has(key)) break;
      seen.add(key);

      const choice = chooseRepertoireMove(rep, fen, { mode: 'uniform-random', rng: attemptRng });
      if (!choice) break;

      fensBefore.push(fen);
      choices.push(choice);
      sans.push(choice.san);
      const played = chess.move({
        from: choice.from,
        to: choice.to,
        promotion: choice.promotion || 'q',
      });
      if (!played) break;
    }

    if (sans.length === 0) continue;
    const candidate: ContinueLinePath = {
      id: pathId(sans),
      sans,
      fensBefore,
      choices,
    };
    if (!recent.has(candidate.id)) return candidate;
    best = candidate;
  }

  return best;
}

/**
 * Choose a start ply so the user still has a meaningful tail to recite.
 * Prefer not always starting at move 1 when the path is long enough.
 */
export function pickStartPly(
  pathLength: number,
  options: { minTail?: number; rng?: () => number } = {},
): number {
  const minTail = options.minTail ?? 3;
  const rng = options.rng ?? Math.random;
  if (pathLength <= minTail) return 0;
  const maxStart = pathLength - minTail;
  return Math.floor(rng() * (maxStart + 1));
}

/** Advance a board along SANs and return the resulting FEN. */
export function fenAfterSans(startFen: string, sans: string[]): string {
  const chess = new Chess(startFen);
  for (const san of sans) {
    const m = chess.move(san);
    if (!m) throw new Error(`Illegal SAN in path: ${san}`);
  }
  return chess.fen();
}

/** True when UCI appears among repertoire moves at fen. */
export function isBookUci(
  rep: ParsedRepertoire,
  fen: string,
  from: string,
  to: string,
  promotion?: string | null,
): boolean {
  const uci = `${from}${to}${promotion ?? ''}`;
  return movesForPosition(rep, fen).some((m) => m.uci === uci);
}

/**
 * Build a proposed continuation from a position (prefer first / main).
 */
export function proposedContinuationSans(
  rep: ParsedRepertoire,
  fen: string,
  maxPlies = 12,
  preferSans?: string[],
): string[] {
  const board = new Chess(fen);
  const out: string[] = [];
  for (let i = 0; i < maxPlies; i++) {
    const at = board.fen();
    let next = preferSans?.[i]
      ? movesForPosition(rep, at).find((m) => m.san === preferSans[i])
      : undefined;
    if (!next) {
      next = chooseRepertoireMove(rep, at, { mode: 'first' }) ?? undefined;
    }
    if (!next) break;
    const played = board.move({
      from: next.from,
      to: next.to,
      promotion: next.promotion || 'q',
    });
    if (!played) break;
    out.push(next.san);
  }
  return out;
}
