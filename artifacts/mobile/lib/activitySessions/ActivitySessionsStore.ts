/**
 * Persisted multi-activity registry. Each session has its own id so starting
 * a new activity never silently overwrites another.
 *
 * Termination is durable: ended ids are marked synchronously so a still-mounted
 * screen cannot recreate a session after Home Quitter / Abandonner / back.
 * All mutations share one write queue so deleting A cannot resurrect from a
 * concurrent save of B, and B cannot be wiped by A's removal.
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
let writeTail: Promise<void> = Promise.resolve();
const listeners = new Set<Listener>();
const endedIds = new Set<string>();

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

function stripEnded(doc: ActivitySessionsDocument): ActivitySessionsDocument {
  let changed = false;
  const sessions: Record<string, ActivitySessionRecord> = {};
  for (const [id, session] of Object.entries(doc.sessions)) {
    if (endedIds.has(id)) {
      changed = true;
      continue;
    }
    sessions[id] = session;
  }
  return changed ? { version: ACTIVITY_SESSIONS_VERSION, sessions } : doc;
}

function evictFromMemory(id: string): void {
  if (!memory?.sessions[id]) return;
  const sessions = { ...memory.sessions };
  delete sessions[id];
  memory = { version: ACTIVITY_SESSIONS_VERSION, sessions };
  emit();
}

function enqueueWrite<T>(job: () => Promise<T>): Promise<T> {
  const run = writeTail.then(job, job);
  writeTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Write disk first, then publish memory. A failed write still publishes the
 * intended in-process snapshot so UI and later jobs stay consistent; the next
 * successful persist heals disk. Never wipes the whole registry on one failure.
 */
async function persist(doc: ActivitySessionsDocument): Promise<void> {
  const cleaned = stripEnded(doc);
  try {
    await storage.setItem(StorageKeys.activitySessions.key, JSON.stringify(cleaned));
  } catch {
    memory = cleaned;
    emit();
    return;
  }
  memory = cleaned;
  emit();
}

export function isActivitySessionEnded(id: string): boolean {
  return Boolean(id) && endedIds.has(id);
}

export function canPersistActivitySession(id: string): boolean {
  return Boolean(id) && !endedIds.has(id);
}

/** Synchronous terminal mark — Home Quitter must reach still-mounted screens. */
export function markActivitySessionEnded(id: string): void {
  if (!id) return;
  endedIds.add(id);
  evictFromMemory(id);
}

export function __setActivitySessionsStorageForTests(next: KeyValueStorage): void {
  storage = next;
  memory = null;
  loadPromise = null;
  writeTail = Promise.resolve();
  endedIds.clear();
}

/** Drop the in-memory snapshot and reload disk, keeping the ended-id registry. */
export async function __hydrateActivitySessionsFromStorageForTests(): Promise<ActivitySessionsDocument> {
  memory = null;
  loadPromise = null;
  return loadActivitySessions();
}

export function subscribeActivitySessions(listener: Listener): () => void {
  listeners.add(listener);
  if (memory) listener(memory);
  return () => {
    listeners.delete(listener);
  };
}

export async function loadActivitySessions(): Promise<ActivitySessionsDocument> {
  if (memory) {
    const cleaned = stripEnded(memory);
    if (cleaned !== memory) memory = cleaned;
    return memory;
  }
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const result = await loadStoredJson(
      storage,
      StorageKeys.activitySessions.key,
      EMPTY,
      parseDocument,
    );
    memory = stripEnded(result.value ?? EMPTY);
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
  return memory ? stripEnded(memory) : EMPTY;
}

export function listInProgressActivities(): ActivitySessionRecord[] {
  const doc = getActivitySessionsSnapshot();
  return Object.values(doc.sessions)
    .filter((s) => s.inProgress)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getActivitySession(id: string): ActivitySessionRecord | null {
  if (isActivitySessionEnded(id)) return null;
  return getActivitySessionsSnapshot().sessions[id] ?? null;
}

export async function upsertActivitySession(
  record: ActivitySessionRecord,
): Promise<ActivitySessionRecord> {
  if (!canPersistActivitySession(record.id)) {
    return getActivitySession(record.id) ?? record;
  }
  return enqueueWrite(async () => {
    if (!canPersistActivitySession(record.id)) {
      return getActivitySession(record.id) ?? record;
    }
    const doc = await loadActivitySessions();
    if (!canPersistActivitySession(record.id)) {
      return getActivitySession(record.id) ?? record;
    }
    const next: ActivitySessionsDocument = {
      version: ACTIVITY_SESSIONS_VERSION,
      sessions: {
        ...doc.sessions,
        [record.id]: { ...record, updatedAt: Date.now() },
      },
    };
    await persist(next);
    return getActivitySession(record.id) ?? next.sessions[record.id]!;
  });
}

export async function removeActivitySession(id: string): Promise<void> {
  if (id) endedIds.add(id);
  evictFromMemory(id);
  return enqueueWrite(async () => {
    const doc = await loadActivitySessions();
    if (!doc.sessions[id]) {
      await persist(stripEnded(doc));
      return;
    }
    const sessions = { ...doc.sessions };
    delete sessions[id];
    await persist({ version: ACTIVITY_SESSIONS_VERSION, sessions });
  });
}

export async function markActivityFinished(id: string): Promise<void> {
  if (!canPersistActivitySession(id)) return;
  return enqueueWrite(async () => {
    if (!canPersistActivitySession(id)) return;
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
  });
}
