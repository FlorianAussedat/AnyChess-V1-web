/**
 * Central termination of one persisted activity.
 * Removes only that session — never the rest of the registry, and never
 * permanent user data (repertoire PGN, library games, records).
 */
import { getActivitySession, removeActivitySession } from './ActivitySessionsStore.ts';

export async function endActivity(activityId: string): Promise<void> {
  if (!activityId) return;
  const current = getActivitySession(activityId);
  if (!current) return;
  await removeActivitySession(activityId);
}
