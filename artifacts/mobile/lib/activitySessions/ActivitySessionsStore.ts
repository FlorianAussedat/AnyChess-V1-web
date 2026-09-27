/**
 * Persisted multi-activity registry. Each session has its own id so starting
 * a new activity never silently overwrites another.
 */
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import {
  ACTIVITY_SESSIONS_VERSION,
  type ActivitySessionRecord,
  type ActivitySessionsDocument,
} from './types.ts';

const EMPTY: ActivitySessionsDocument = {
  version: ACTIVITY_SESSIONS_VERSION,
  sessions: {},
};

type Listener = (doc: ActivitySessionsDocument) => void;

let storage: KeyValueStorage = defaultKeyValueStorage;
let memory: ActivitySessionsDocument | null = null;
let loadPromise: Promise<ActivitySessionsDocument> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  if (!memory) return;
  for (const listener of listeners) listener(memory);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSession(raw: unknown): ActivitySessionRecord | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.kind !== 'string') return null;
  if (typeof raw.modeId !== 'string') return null;
  if (typeof raw.noun !== 'string') return null;
  if (typeof raw.title !== 'string') return null;
  if (typeof raw.summary !== 'string') return null;
  if (typeof raw.route !== 'string') return null;
  if (typeof raw.updatedAt !== 'number') return null;
  return {
    id: raw.id,
    kind: raw.kind as ActivitySessionRecord['kind'],
    modeId: raw.modeId as ActivitySessionRecord['modeId'],
    noun: raw.noun as ActivitySessionRecord['noun'],
    title: raw.title,
    summary: raw.summary,
    route: raw.route,
    updatedAt: raw.updatedAt,
    inProgress: raw.inProgress !== false,
    payload: raw.payload,
  };
}

function parseDocument(raw: unknown): ActivitySessionsDocument | null {
  if (!isRecord(raw)) return null;
  if (raw.version !== ACTIVITY_SESSIONS_VERSION) return null;
  if (!isRecord(raw.sessions)) return null;
  const sessions: Record<string, ActivitySessionRecord> = {};
  for (const [id, value] of Object.entries(raw.sessions)) {
    const parsed = parseSession(value);
    if (parsed) sessions[id] = parsed;
  }
  return { version: ACTIVITY_SESSIONS_VERSION, sessions };
}

async function persist(doc: ActivitySessionsDocument): Promise<void> {
  memory = doc;
  emit();
  await storage.setItem(StorageKeys.activitySessions.key, JSON.stringify(doc));
}

export function __setActivitySessionsStorageForTests(next: KeyValueStorage): void {
  storage = next;
  memory = null;
  loadPromise = null;
}

export function subscribeActivitySessions(listener: Listener): () => void {
  listeners.add(listener);
  if (memory) listener(memory);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadActivitySessions(): Promise<ActivitySessionsDocument> {
  if (memory) return memory;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const result = await loadStoredJson(
      storage,
      StorageKeys.activitySessions.key,
      EMPTY,
      parseDocument,
    );
    memory = result.value ?? EMPTY;
    emit();
    return memory;
  })();
  try {
    return await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export function getActivitySessionsSnapshot(): ActivitySessionsDocument {
  return memory ?? EMPTY;
}

export function listInProgressActivities(): ActivitySessionRecord[] {
  const doc = getActivitySessionsSnapshot();
  return Object.values(doc.sessions)
    .filter((s) => s.inProgress)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActivitySession(id: string): ActivitySessionRecord | null {
  return getActivitySessionsSnapshot().sessions[id] ?? null;
}

export async function upsertActivitySession(
  record: ActivitySessionRecord,
): Promise<ActivitySessionRecord> {
  const doc = await loadActivitySessions();
  const next: ActivitySessionsDocument = {
    version: ACTIVITY_SESSIONS_VERSION,
    sessions: {
      ...doc.sessions,
      [record.id]: { ...record, updatedAt: Date.now() },
    },
  };
  await persist(next);
  return next.sessions[record.id]!;
}

export async function removeActivitySession(id: string): Promise<void> {
  const doc = await loadActivitySessions();
  if (!doc.sessions[id]) return;
  const sessions = { ...doc.sessions };
  delete sessions[id];
  await persist({ version: ACTIVITY_SESSIONS_VERSION, sessions });
}

export async function markActivityFinished(id: string): Promise<void> {
  const doc = await loadActivitySessions();
  const current = doc.sessions[id];
  if (!current) return;
  await persist({
    version: ACTIVITY_SESSIONS_VERSION,
    sessions: {
      ...doc.sessions,
      [id]: { ...current, inProgress: false, updatedAt: Date.now() },
    },
  });
}
