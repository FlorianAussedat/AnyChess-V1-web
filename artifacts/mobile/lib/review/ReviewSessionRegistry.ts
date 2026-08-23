/**
 * In-memory review / overlay session registry.
 * Avoids large PGN payloads in URL params — use session ids instead.
 */
import type { EvaluationPoint, FirstMajorTurn } from '../endgameTraining/domain/types.ts';
import type { DefenderColor } from '../endgameTraining/domain/types.ts';

export type ReviewMode = 'defend-draw' | 'theoretical' | 'classic' | 'opening' | 'tactical';

export type ReviewLaunchPayload = {
  mode: ReviewMode;
  startFen: string;
  orientation: DefenderColor;
  moveSans: string[];
  timeline: EvaluationPoint[];
  firstMajorTurn?: FirstMajorTurn | null;
  positionId?: string;
  themeId?: string;
  /** Original scored attempt result id / snapshot — preserved when overlay closes. */
  parentResultKey?: string;
  lossThresholdCp?: number;
  objective?: 'DRAW' | 'WIN';
};

export type FinishGamePayload = {
  fen: string;
  orientation: DefenderColor;
  moveSans: string[];
  /** Original exercise result — unchanged by finish-game. */
  lockedOutcome: string;
  positionId?: string;
  mode: ReviewMode;
};

export type ReviewSessionEntry =
  | { kind: 'analysis'; payload: ReviewLaunchPayload }
  | { kind: 'finish-game'; payload: FinishGamePayload };

let nextId = 1;

function genId(): string {
  const id = `review-${Date.now()}-${nextId}`;
  nextId += 1;
  return id;
}

const sessions = new Map<string, ReviewSessionEntry>();

export function registerReviewSession(entry: ReviewSessionEntry): string {
  const id = genId();
  sessions.set(id, entry);
  return id;
}

export function getReviewSession(id: string): ReviewSessionEntry | null {
  return sessions.get(id) ?? null;
}

export function unregisterReviewSession(id: string): void {
  sessions.delete(id);
}

/** @internal test helper */
export function clearReviewSessions(): void {
  sessions.clear();
}
