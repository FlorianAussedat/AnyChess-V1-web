/**
 * Replay timing for Construis l’ouverture result review.
 * Wrong-answer (learning) replay is 2× slower than normal completion replay.
 */
import { DEFAULT_REPLAY_INTERVAL_MS } from '../replay/replayLine.ts';

export const NORMAL_REPLAY_INTERVAL_MS = DEFAULT_REPLAY_INTERVAL_MS;
export const LEARNING_REPLAY_INTERVAL_MS = DEFAULT_REPLAY_INTERVAL_MS * 2;

export type ConstructionReplayKind = 'complete' | 'wrong' | 'review';

/** Interval for automatic result replay or manual « Revoir l’ouverture ». */
export function constructionReplayIntervalMs(kind: ConstructionReplayKind): number {
  if (kind === 'wrong' || kind === 'review') return LEARNING_REPLAY_INTERVAL_MS;
  return NORMAL_REPLAY_INTERVAL_MS;
}
