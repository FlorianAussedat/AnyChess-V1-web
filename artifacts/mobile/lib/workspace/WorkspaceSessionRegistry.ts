/**
 * In-memory registry for universal workspace sessions.
 */
import type { ChessWorkspacePayload } from './types.ts';
import { validateWorkspacePayload } from './types.ts';

export type ChessWorkspacePresentation = 'page' | 'overlay';

export type ChessWorkspaceSessionEntry = {
  id: string;
  createdAt: number;
  presentation: ChessWorkspacePresentation;
  payload: ChessWorkspacePayload;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;
let nextId = 1;
const sessions = new Map<string, ChessWorkspaceSessionEntry>();

function genId(): string {
  const id = `workspace-${Date.now()}-${nextId}`;
  nextId += 1;
  return id;
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function createChessWorkspaceSession(
  payload: ChessWorkspacePayload,
  presentation: ChessWorkspacePresentation = 'overlay',
): string {
  pruneExpired();
  const checked = validateWorkspacePayload(payload);
  if (!checked.ok) {
    throw new Error(checked.error);
  }
  const id = genId();
  sessions.set(id, {
    id,
    createdAt: Date.now(),
    presentation,
    payload: checked.payload,
  });
  return id;
}

export function getChessWorkspaceSession(
  id: string,
): ChessWorkspaceSessionEntry | null {
  pruneExpired();
  return sessions.get(id) ?? null;
}

export function closeChessWorkspaceSession(id: string): void {
  sessions.delete(id);
}

export function clearChessWorkspaceSessions(): void {
  sessions.clear();
}
