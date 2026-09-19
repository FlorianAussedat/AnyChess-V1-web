/**
 * In-memory session for a single-line opening exercise.
 * Never written to the repertoire store.
 */
export type EphemeralOpeningSession = {
  fileId: string;
  folderId: string;
  pathSans: string[];
  pathId: string;
  sourcePgn: string;
  displayName: string;
  side: 'white' | 'black';
  origin: 'review' | 'study';
};

let current: EphemeralOpeningSession | null = null;

export function setEphemeralOpeningSession(
  session: EphemeralOpeningSession | null,
): void {
  current = session;
}

export function getEphemeralOpeningSession(): EphemeralOpeningSession | null {
  return current;
}

export function clearEphemeralOpeningSession(): void {
  current = null;
}
