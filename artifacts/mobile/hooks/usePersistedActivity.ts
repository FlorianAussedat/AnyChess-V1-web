/**
 * Snapshot an in-progress activity to the multi-session store.
 * Creates a new id unless `resumeSessionId` is provided — never overwrites
 * another activity by kind.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createActivitySessionId,
  getActivitySession,
  markActivityFinished,
  nounForKind,
  removeActivitySession,
  upsertActivitySession,
  type ActivityKind,
  type ActivityNoun,
  type ActivitySessionRecord,
} from '@/lib/activitySessions';
import type { MainModeId } from '@/lib/app/modes';

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
  const sessionIdRef = useRef(resumeSessionId || createActivitySessionId());
  const restoredRef = useRef(false);
  const captureRef = useRef(capture);
  captureRef.current = capture;
  const applyRef = useRef(apply);
  applyRef.current = apply;
  const metaRef = useRef({ title, summary, routeFor, kind, modeId, noun });
  metaRef.current = { title, summary, routeFor, kind, modeId, noun };

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (!resumeSessionId) return;
    const record = getActivitySession(resumeSessionId);
    if (!record) return;
    applyRef.current?.(record.payload as T);
  }, [resumeSessionId]);

  const flush = useCallback(async () => {
    if (!enabled) return;
    const payload = captureRef.current();
    if (payload == null) return;
    const meta = metaRef.current;
    const record: ActivitySessionRecord = {
      id: sessionIdRef.current,
      kind: meta.kind,
      modeId: meta.modeId,
      noun: meta.noun,
      title: meta.title,
      summary: meta.summary,
      route: meta.routeFor(sessionIdRef.current),
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
    }, 250);
    return () => clearTimeout(timer);
  }, [enabled, flush, revision, title, summary]);

  const wasEnabledRef = useRef(false);
  useEffect(() => {
    if (wasEnabledRef.current && !enabled) {
      void markActivityFinished(sessionIdRef.current);
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
    await removeActivitySession(sessionIdRef.current);
  }, []);

  return { sessionId: sessionIdRef.current, noun, discard };
}
