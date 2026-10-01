/**
 * Snapshot an in-progress activity to the multi-session store.
 * Creates a new id unless `resumeSessionId` is provided — never overwrites
 * another activity by kind.
 *
 * After endActivity, flush/AppState/unmount must not recreate the old id.
 * A new game on the same mounted screen mints a fresh session id.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  canPersistActivitySession,
  createActivitySessionId,
  getActivitySession,
  endActivity,
  isActivitySessionEnded,
  markActivityFinished,
  nounForKind,
  upsertActivitySession,
  type ActivityKind,
  type ActivityNoun,
  type ActivitySessionRecord,
} from '@/lib/activitySessions';
import type { MainModeId } from '@/lib/app/modes';

export const ACTIVITY_PERSIST_DEBOUNCE_MS = 250;

export function usePersistedActivity<T>(args: {
  kind: ActivityKind;
  modeId: MainModeId;
  resumeSessionId?: string;
  title: string;
  summary: string;
  routeFor: (id: string) => string;
  enabled: boolean;
  /** Bump when captured state changes so a debounce flush runs. */
  revision: number | string;
  capture: () => T | null;
  apply?: (payload: T) => void;
}): {
  sessionId: string;
  noun: ActivityNoun;
  discard: () => Promise<void>;
} {
  const {
    kind,
    modeId,
    resumeSessionId,
    title,
    summary,
    routeFor,
    enabled,
    revision,
    capture,
    apply,
  } = args;
  const noun = nounForKind(kind);
  const [sessionId, setSessionId] = useState(
    () => resumeSessionId || createActivitySessionId(),
  );
  const sessionIdRef = useRef(sessionId);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const metaRef = useRef({ title, summary, routeFor, kind, modeId, noun });
  metaRef.current = { title, summary, routeFor, kind, modeId, noun };

  const assignSessionId = useCallback((next: string) => {
    if (sessionIdRef.current === next) return;
    sessionIdRef.current = next;
    setSessionId(next);
  }, []);

  useEffect(() => {
    if (!resumeSessionId) return;
    if (isActivitySessionEnded(resumeSessionId)) return;
    assignSessionId(resumeSessionId);
    const record = getActivitySession(resumeSessionId);
    if (!record) return;
    applyRef.current?.(record.payload as T);
  }, [assignSessionId, resumeSessionId]);

  useEffect(() => {
    if (!enabled) return;
    if (!isActivitySessionEnded(sessionIdRef.current)) return;
    assignSessionId(createActivitySessionId());
  }, [assignSessionId, enabled]);

  const flush = useCallback(async () => {
    if (!enabled) return;
    const id = sessionIdRef.current;
    if (!canPersistActivitySession(id)) return;
    const payload = captureRef.current();
    if (payload == null) return;
    const meta = metaRef.current;
    const record: ActivitySessionRecord = {
      id,
      kind: meta.kind,
      modeId: meta.modeId,
      noun: meta.noun,
      title: meta.title,
      summary: meta.summary,
      route: meta.routeFor(id),
      updatedAt: Date.now(),
      inProgress: true,
      payload,
    };
    await upsertActivitySession(record);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      void flush();
    }, ACTIVITY_PERSIST_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, flush, revision, title, summary, sessionId]);

  const wasEnabledRef = useRef(false);
  useEffect(() => {
    if (wasEnabledRef.current && !enabled) {
      const id = sessionIdRef.current;
      if (canPersistActivitySession(id)) {
        void markActivityFinished(id);
      }
    }
    wasEnabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state !== 'active') void flush();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      void flush();
    };
  }, [flush]);

  const discard = useCallback(async () => {
    await endActivity(sessionIdRef.current);
  }, []);

  return { sessionId, noun, discard };
}
