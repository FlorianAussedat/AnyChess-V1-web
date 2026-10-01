import { openingMasteryStore } from './OpeningMasteryStore.ts';
import type { OpeningRevisionResult } from './openingMastery.ts';

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
