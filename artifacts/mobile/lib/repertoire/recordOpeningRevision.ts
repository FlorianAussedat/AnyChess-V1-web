import { openingMasteryStore, type OpeningMasteryStore } from './OpeningMasteryStore.ts';
import { openingLineKey } from './openingMastery.ts';
import type { OpeningRevisionResult } from './openingMastery.ts';
import {
  getEphemeralOpeningSession,
  setEphemeralOpeningSession,
} from './ephemeralOpeningSession.ts';

/**
 * Persist a Review outcome. Learning (origin !== 'review') is a no-op.
 */
export async function recordOpeningRevisionResult(
  origin: string | null | undefined,
  fileId: string | null | undefined,
  pathId: string | null | undefined,
  result: OpeningRevisionResult,
): Promise<void> {
  if (origin !== 'review') return;
  if (!fileId || !pathId) return;
  await openingMasteryStore.recordResult(fileId, pathId, result);
}

export type CommitOpeningReviewAttemptResult = {
  recorded: boolean;
  totalAttempts: number;
  totalSuccesses: number;
};

/**
 * Record a finished Review line once. Reopening the bilan or returning to the
 * screen must not append a second history entry.
 */
export async function commitOpeningReviewAttempt(
  origin: string | null | undefined,
  fileId: string | null | undefined,
  pathId: string | null | undefined,
  result: OpeningRevisionResult,
  store: OpeningMasteryStore = openingMasteryStore,
): Promise<CommitOpeningReviewAttemptResult> {
  if (origin !== 'review' || !fileId || !pathId) {
    return { recorded: false, totalAttempts: 0, totalSuccesses: 0 };
  }
  await store.ensureLoaded();
  const session = getEphemeralOpeningSession();
  if (
    session &&
    session.fileId === fileId &&
    session.pathId === pathId &&
    session.revisionRecorded
  ) {
    const rec = store.getSnapshot().lines[openingLineKey(fileId, pathId)];
    return {
      recorded: false,
      totalAttempts: rec?.totalAttempts ?? 0,
      totalSuccesses: rec?.totalSuccesses ?? 0,
    };
  }
  const rec = await store.recordResult(fileId, pathId, result);
  if (session && session.fileId === fileId && session.pathId === pathId) {
    setEphemeralOpeningSession({ ...session, revisionRecorded: true });
  }
  return {
    recorded: true,
    totalAttempts: rec.totalAttempts,
    totalSuccesses: rec.totalSuccesses,
  };
}

/** Allow a restart of the same parked line to become a new attempt. */
export function resetOpeningReviewRecordedFlag(): void {
  const session = getEphemeralOpeningSession();
  if (!session?.revisionRecorded) return;
  setEphemeralOpeningSession({ ...session, revisionRecorded: false });
}
