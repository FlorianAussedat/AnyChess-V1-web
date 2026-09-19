/**
 * Sample linear repertoire paths and mid-line starting points.
 * Pure chess logic — no UI.
 */
import { Chess } from 'chess.js';
import {
  chooseRepertoireMove,
  movesForPosition,
  positionKey,
} from '../repertoire/repertoireTree.ts';
import type { ParsedRepertoire } from '../repertoire/types.ts';
import type { ContinueLinePath } from './types.ts';

export type PathSampleOptions = {
  startFen?: string;
  rng?: () => number;
  /** Avoid immediately reusing these path ids. */
  recentPathIds?: string[];
  maxAttempts?: number;
};

/** Every imported root-to-leaf branch has one slot, regardless of depth. */
export function trainingPaths(rep: ParsedRepertoire): ContinueLinePath[] {
  return rep.trainingPaths ?? [];
}

/** Recent ids are newest first. Exhaust unseen lines, then take the oldest. */
export function pickBalanced<T>(items: T[], key: (item: T) => string, recent: string[], rng: () => number): T | null {
  if (!items.length) return null;
  const seen = new Map(recent.map((id, i) => [id, i]));
  const unseen = items.filter(item => !seen.has(key(item)));
  if (unseen.length) return unseen[Math.min(unseen.length - 1, Math.floor(rng() * unseen.length))]!;
  return items.reduce((oldest, item) => seen.get(key(item))! > seen.get(key(oldest))! ? item : oldest);
}

export function sampleRandomPath(rep: ParsedRepertoire, options: PathSampleOptions = {}): ContinueLinePath | null {
  const paths = trainingPaths(rep).filter(p => !options.startFen || positionKey(p.fensBefore[0]!) === positionKey(options.startFen));
  return pickBalanced(paths, p => p.id, options.recentPathIds ?? [], options.rng ?? Math.random);
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

