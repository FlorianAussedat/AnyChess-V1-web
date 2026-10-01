/**
 * Distinguish a proven daily quota from a temporary request throttle.
 * Never treat HTTP 429 alone as an exhausted quota.
 */

export type MyMemoryClassifiedError =
  | 'quota'
  | 'rate_limited'
  | 'timeout'
  | 'offline'
  | 'rejected';

export type MyMemoryClassifyInput = {
  httpStatus?: number;
  responseStatus?: number;
  quotaFinished?: boolean;
  details?: string;
  retryAfterMs?: number;
  aborted?: boolean;
  networkError?: boolean;
};

export type MyMemoryClassifyResult = {
  error: MyMemoryClassifiedError;
  retryAfterMs?: number;
  reason: string;
};

const QUOTA_TEXT = /YOU USED ALL AVAILABLE FREE TRANSLATIONS/i;

export function isExhaustedQuotaSignal(
  details?: string,
  quotaFinished?: boolean,
): boolean {
  if (quotaFinished === true) return true;
  return Boolean(details && QUOTA_TEXT.test(details));
}

export function parseRetryAfterMs(raw: string | null | undefined): number | undefined {
  if (!raw?.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 120_000);
  }
  const date = Date.parse(raw);
  if (Number.isFinite(date)) {
    return Math.min(Math.max(0, date - Date.now()), 120_000);
  }
  return undefined;
}

export function classifyMyMemoryResponse(
  input: MyMemoryClassifyInput,
): MyMemoryClassifyResult {
  if (input.aborted) {
    return { error: 'timeout', reason: 'aborted' };
  }
  if (input.networkError) {
    return { error: 'offline', reason: 'network' };
  }
  if (isExhaustedQuotaSignal(input.details, input.quotaFinished)) {
    return { error: 'quota', reason: input.quotaFinished ? 'quotaFinished' : 'quotaText' };
  }
  const http = input.httpStatus ?? 0;
  const bodyStatus = input.responseStatus ?? 0;
  const retryAfterMs = input.retryAfterMs;
  if (http === 429 || bodyStatus === 429) {
    return {
      error: 'rate_limited',
      retryAfterMs: retryAfterMs ?? 5_000,
      reason: http === 429 ? 'http429' : 'body429',
    };
  }
  if (http === 403) {
    return { error: 'rejected', reason: 'http403' };
  }
  if (http && http !== 200) {
    return { error: 'offline', reason: `http${http}` };
  }
  if (bodyStatus && bodyStatus !== 200) {
    return { error: 'rejected', reason: `body${bodyStatus}` };
  }
  return { error: 'rejected', reason: 'empty' };
}

export function logPgnTranslate(
  event: string,
  fields: Record<string, string | number | boolean | undefined | null>,
): void {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (/key|secret|token|authorization|comment|text|query|q=/i.test(key)) continue;
    safe[key] = value;
  }
  console.log(`[PgnTranslate] ${event} ${JSON.stringify(safe)}`);
}
