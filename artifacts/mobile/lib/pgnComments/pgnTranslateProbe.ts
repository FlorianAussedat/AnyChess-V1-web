/**
 * Temporary in-memory diagnostic for PGN translation.
 * Never stores comment text, query strings, or keys.
 */
import type { PgnTranslationQueue } from './PgnTranslationQueue.ts';
import {
  extractOfficialMyMemoryQuotaMessage,
  isExhaustedQuotaSignal,
  parseMyMemoryNextAvailableLabel,
} from './classifyMyMemory.ts';

/** Visible in Settings — if the phone does not show this, it is not on this bundle. */
export const PGN_TRANSLATE_CLIENT_BUILD = 'pgn-diag-2026-10-01b';

/** Documented anonymous Get limit: no `de` e-mail and no key in our client URL. */
export const MYMEMORY_ANONYMOUS_DAILY_LIMIT_CHARS = 5000;

export type PgnTranslateCallProbe = {
  httpStatus: number | null;
  responseStatus: number | null;
  quotaFinished: boolean | null;
  reason: string | null;
  retryAfterMs: number | null;
  classifiedError: string | null;
  detailsHasOfficialQuotaText: boolean | null;
  detailsLength: number | null;
  durationMs: number | null;
  /** Official quota sentence only. Never comment, PGN, e-mail, or query text. */
  providerMessage: string | null;
  nextAvailable: string | null;
};

export type PgnTranslateProbeSnapshot = {
  clientBuild: string;
  hasPr79Classifier: true;
  lastErrorPersistedToDisk: false;
  lastErrorInMemory: string | null;
  lastErrorBeforeRetry: string | null;
  trigger: 'none' | 'retry-start' | 'retry' | 'auto';
  lastCallAt: string | null;
  lastCall: PgnTranslateCallProbe | null;
  jobs: {
    done: number;
    queued: number;
    failed: number;
    withErrorQuota: number;
    withErrorRateLimited: number;
  };
};

type InternalState = {
  lastErrorBeforeRetry: string | null;
  trigger: PgnTranslateProbeSnapshot['trigger'];
  lastCallAt: string | null;
  lastCall: PgnTranslateCallProbe | null;
};

const emptyCall = (): PgnTranslateCallProbe => ({
  httpStatus: null,
  responseStatus: null,
  quotaFinished: null,
  reason: null,
  retryAfterMs: null,
  classifiedError: null,
  detailsHasOfficialQuotaText: null,
  detailsLength: null,
  durationMs: null,
  providerMessage: null,
  nextAvailable: null,
});

const state: InternalState = {
  lastErrorBeforeRetry: null,
  trigger: 'none',
  lastCallAt: null,
  lastCall: null,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribePgnTranslateProbe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markPgnTranslateRetryStarted(lastErrorInMemory: string | null): void {
  state.lastErrorBeforeRetry = lastErrorInMemory;
  state.trigger = 'retry-start';
  emit();
}

export function recordPgnTranslateCall(input: {
  trigger?: 'retry' | 'auto';
  httpStatus?: number;
  responseStatus?: number;
  quotaFinished?: boolean;
  reason?: string;
  retryAfterMs?: number;
  classifiedError?: string;
  details?: string;
  durationMs?: number;
}): void {
  const details = input.details;
  state.lastCallAt = new Date().toISOString();
  if (state.trigger === 'retry-start') {
    state.trigger = 'retry';
  } else if (input.trigger) {
    state.trigger = input.trigger;
  } else if (state.trigger === 'none') {
    state.trigger = 'auto';
  }
  state.lastCall = {
    ...emptyCall(),
    httpStatus: input.httpStatus ?? null,
    responseStatus: input.responseStatus ?? null,
    quotaFinished: input.quotaFinished ?? null,
    reason: input.reason ?? null,
    retryAfterMs: input.retryAfterMs ?? null,
    classifiedError: input.classifiedError ?? null,
    detailsHasOfficialQuotaText:
      details === undefined ? null : isExhaustedQuotaSignal(details, false),
    detailsLength: details === undefined ? null : details.length,
    durationMs: input.durationMs ?? null,
    providerMessage:
      details === undefined ? null : extractOfficialMyMemoryQuotaMessage(details),
    nextAvailable:
      details === undefined ? null : parseMyMemoryNextAvailableLabel(details),
  };
  emit();
}

function jobCounts(queue: PgnTranslationQueue): PgnTranslateProbeSnapshot['jobs'] {
  const jobs = Object.values(queue.getSnapshot().jobs);
  return {
    done: jobs.filter((job) => job.status === 'done').length,
    queued: jobs.filter(
      (job) => job.status === 'queued' || job.status === 'running' || job.status === 'paused',
    ).length,
    failed: jobs.filter((job) => job.status === 'failed').length,
    withErrorQuota: jobs.filter((job) => job.error === 'quota').length,
    withErrorRateLimited: jobs.filter((job) => job.error === 'rate_limited').length,
  };
}

export function getPgnTranslateProbeSnapshot(
  queue: PgnTranslationQueue,
): PgnTranslateProbeSnapshot {
  return {
    clientBuild: PGN_TRANSLATE_CLIENT_BUILD,
    hasPr79Classifier: true,
    lastErrorPersistedToDisk: false,
    lastErrorInMemory: queue.getLastError(),
    lastErrorBeforeRetry: state.lastErrorBeforeRetry,
    trigger: state.trigger,
    lastCallAt: state.lastCallAt,
    lastCall: state.lastCall,
    jobs: jobCounts(queue),
  };
}

export function formatPgnTranslateProbe(snapshot: PgnTranslateProbeSnapshot): string {
  const call = snapshot.lastCall;
  const lines = [
    `clientBuild=${snapshot.clientBuild}`,
    `hasPr79Classifier=${snapshot.hasPr79Classifier}`,
    `lastErrorPersistedToDisk=${snapshot.lastErrorPersistedToDisk}`,
    `lastErrorInMemory=${snapshot.lastErrorInMemory ?? 'null'}`,
    `lastErrorBeforeRetry=${snapshot.lastErrorBeforeRetry ?? 'null'}`,
    `trigger=${snapshot.trigger}`,
    `lastCallAt=${snapshot.lastCallAt ?? 'null'}`,
    `httpStatus=${call?.httpStatus ?? 'null'}`,
    `responseStatus=${call?.responseStatus ?? 'null'}`,
    `quotaFinished=${call?.quotaFinished ?? 'null'}`,
    `reason=${call?.reason ?? 'null'}`,
    `retryAfterMs=${call?.retryAfterMs ?? 'null'}`,
    `classifiedError=${call?.classifiedError ?? 'null'}`,
    `detailsHasOfficialQuotaText=${call?.detailsHasOfficialQuotaText ?? 'null'}`,
    `detailsLength=${call?.detailsLength ?? 'null'}`,
    `durationMs=${call?.durationMs ?? 'null'}`,
    `providerMessage=${call?.providerMessage ?? 'null'}`,
    `nextAvailable=${call?.nextAvailable ?? 'null'}`,
    `hasEmailParam=false`,
    `anonymousDailyLimitChars=${MYMEMORY_ANONYMOUS_DAILY_LIMIT_CHARS}`,
    `jobs.done=${snapshot.jobs.done}`,
    `jobs.queued=${snapshot.jobs.queued}`,
    `jobs.failed=${snapshot.jobs.failed}`,
    `jobs.withErrorQuota=${snapshot.jobs.withErrorQuota}`,
    `jobs.withErrorRateLimited=${snapshot.jobs.withErrorRateLimited}`,
  ];
  return lines.join('\n');
}

/** Test helper. */
export function resetPgnTranslateProbeForTests(): void {
  state.lastErrorBeforeRetry = null;
  state.trigger = 'none';
  state.lastCallAt = null;
  state.lastCall = null;
}
