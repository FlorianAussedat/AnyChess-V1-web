/**
 * Central termination of one persisted activity.
 * Removes only that session — never the rest of the registry, and never
 * permanent user data (repertoire PGN, library games, records).
 *
 * Marks the id ended synchronously before the async disk write so a debounce,
 * AppState flush, or still-mounted screen cannot recreate it.
 */
import {
  markActivitySessionEnded,
  removeActivitySession,
} from './ActivitySessionsStore.ts';

export async function endActivity(activityId: string): Promise<void> {
  if (!activityId) return;
  markActivitySessionEnded(activityId);
  try {
    await removeActivitySession(activityId);
  } catch {
    // Already evicted and marked ended. A later successful persist heals disk.
  }
}
