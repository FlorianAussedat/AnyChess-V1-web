/**
 * Live EN→FR provider. Default path: MyMemory public API (no client secret).
 * Optional hosted proxy: ANYCHESS_PGN_TRANSLATE_URL (public URL, not a key).
 */
import {
  classifyMyMemoryResponse,
  isExhaustedQuotaSignal,
  logPgnTranslate,
  parseRetryAfterMs,
} from './classifyMyMemory.ts';
import { recordPgnTranslateCall } from './pgnTranslateProbe.ts';
import { protectChessTerms, restoreChessTerms } from './chessGlossary.ts';
import { isEchoTranslation } from './fingerprint.ts';
import {
  protectCommentTokens,
  restoreCommentTokens,
  tokensUnchanged,
} from './protectTokens.ts';
import type { PgnTranslationProvider, PgnTranslationProviderResult } from './types.ts';

const MYMEMORY = 'https://api.mymemory.translated.net/get';
const MAX_CHARS = 500;
const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_GAP_MS = 400;

let translationHold = false;

export function setPgnTranslationHold(hold: boolean): void {
  translationHold = hold;
}

export function isPgnTranslationHeld(): boolean {
  return translationHold;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function translateUrl(): string | null {
  const fromProcess =
    typeof process !== 'undefined' ? process.env.ANYCHESS_PGN_TRANSLATE_URL : undefined;
  const url = fromProcess?.trim();
  return url || null;
}

async function translateViaProxy(
  url: string,
  batch: { id: string; text: string; context?: string }[],
): Promise<PgnTranslationProviderResult[]> {
  const started = Date.now();
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: batch }),
  });
  logPgnTranslate('proxy', {
    httpStatus: response.status,
    durationMs: Date.now() - started,
    batch: batch.length,
  });
  if (!response.ok) {
    const classified = classifyMyMemoryResponse({
      httpStatus: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get('retry-after')),
    });
    return batch.map((item) => ({
      id: item.id,
      error: classified.error,
      retryAfterMs: classified.retryAfterMs,
    }));
  }
  const body = (await response.json()) as {
    items?: { id?: string; text?: string; error?: string }[];
  };
  const rows = Array.isArray(body.items) ? body.items : [];
  return batch.map((item) => {
    const row = rows.find((entry) => entry.id === item.id);
    if (!row?.text) return { id: item.id, error: 'rejected' as const };
    if (!tokensUnchanged(item.text, row.text)) {
      return { id: item.id, error: 'invalid' as const };
    }
    return { id: item.id, text: row.text };
  });
}

export async function translateViaMyMemory(
  text: string,
): Promise<
  | { text: string }
  | { error: 'quota' | 'offline' | 'rejected' | 'timeout' | 'rate_limited'; retryAfterMs?: number }
> {
  const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  const url = `${MYMEMORY}?q=${encodeURIComponent(clipped)}&langpair=en|fr`;
  const started = Date.now();
  let response: Response;
  try {
    response = await fetchWithTimeout(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'AbortError');
    const classified = classifyMyMemoryResponse({
      aborted,
      networkError: !aborted,
    });
    logPgnTranslate('mymemory', {
      error: classified.error,
      reason: classified.reason,
      durationMs: Date.now() - started,
    });
    recordPgnTranslateCall({
      classifiedError: classified.error === 'quota' ? 'offline' : classified.error,
      reason: classified.reason,
      durationMs: Date.now() - started,
    });
    return { error: classified.error === 'quota' ? 'offline' : classified.error };
  }
  let body: {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    quotaFinished?: boolean;
    responseDetails?: string;
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }
  const status = Number(body.responseStatus);
  const translated = body.responseData?.translatedText?.trim();
  const details = `${translated ?? ''} ${body.responseDetails ?? ''}`;
  const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
  const classified = classifyMyMemoryResponse({
    httpStatus: response.status,
    responseStatus: Number.isFinite(status) ? status : undefined,
    quotaFinished: body.quotaFinished,
    details,
    retryAfterMs,
  });
  const exhausted = isExhaustedQuotaSignal(details, body.quotaFinished);
  const throttled = !exhausted && (response.status === 429 || status === 429);
  const ok = response.ok && (!status || status === 200) && Boolean(translated) && !exhausted && !throttled;
  logPgnTranslate('mymemory', {
    httpStatus: response.status,
    responseStatus: Number.isFinite(status) ? status : undefined,
    quotaFinished: Boolean(body.quotaFinished),
    error: ok ? undefined : classified.error,
    reason: ok ? 'ok' : classified.reason,
    durationMs: Date.now() - started,
    retryAfterMs: classified.retryAfterMs,
  });
  recordPgnTranslateCall({
    httpStatus: response.status,
    responseStatus: Number.isFinite(status) ? status : undefined,
    quotaFinished: Boolean(body.quotaFinished),
    classifiedError: ok ? 'ok' : classified.error,
    reason: ok ? 'ok' : classified.reason,
    retryAfterMs: classified.retryAfterMs,
    details,
    durationMs: Date.now() - started,
  });
  if (exhausted) return { error: 'quota' };
  if (throttled) {
    return { error: 'rate_limited', retryAfterMs: retryAfterMs ?? classified.retryAfterMs ?? 5_000 };
  }
  if (!response.ok) {
    return { error: classified.error, retryAfterMs: classified.retryAfterMs };
  }
  if (status && status !== 200) return { error: 'rejected' };
  if (!translated) return { error: 'rejected' };
  return { text: translated };
}

export async function translateEnglishComment(
  original: string,
): Promise<
  | { text: string }
  | {
      error: 'quota' | 'offline' | 'rejected' | 'invalid' | 'timeout' | 'rate_limited';
      retryAfterMs?: number;
    }
> {
  const protectedText = protectCommentTokens(original);
  const glossed = protectChessTerms(protectedText.masked);
  const translated = await translateViaMyMemory(glossed.masked);
  if ('error' in translated) return translated;
  const withTerms = restoreChessTerms(translated.text, glossed.terms);
  const restored = restoreCommentTokens(withTerms, protectedText.tokens);
  if (!tokensUnchanged(original, restored)) return { error: 'invalid' };
  if (isEchoTranslation(original, restored)) return { error: 'rejected' };
  return { text: restored };
}

export class MyMemoryPgnTranslationProvider implements PgnTranslationProvider {
  readonly configured = true;
  private readonly gapMs: number;
  private readonly shouldHold: () => boolean;

  constructor(options?: { gapMs?: number; shouldHold?: () => boolean }) {
    this.gapMs = options?.gapMs ?? DEFAULT_GAP_MS;
    this.shouldHold = options?.shouldHold ?? isPgnTranslationHeld;
  }

  async translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]> {
    const out: PgnTranslationProviderResult[] = [];
    for (const [index, item] of batch.entries()) {
      if (this.shouldHold()) {
        logPgnTranslate('hold', { remaining: batch.length - index });
        for (const leftover of batch.slice(index)) {
          out.push({ id: leftover.id, error: 'held' });
        }
        break;
      }
      if (index > 0 && this.gapMs > 0) {
        await sleep(this.gapMs);
        if (this.shouldHold()) {
          for (const leftover of batch.slice(index)) {
            out.push({ id: leftover.id, error: 'held' });
          }
          break;
        }
      }
      try {
        const result = await translateEnglishComment(item.text);
        if ('error' in result) {
          out.push({
            id: item.id,
            error: result.error,
            retryAfterMs: result.retryAfterMs,
          });
          if (
            result.error === 'quota' ||
            result.error === 'offline' ||
            result.error === 'timeout' ||
            result.error === 'rate_limited'
          ) {
            const rest = batch.slice(out.length);
            for (const leftover of rest) {
              out.push({
                id: leftover.id,
                error: result.error,
                retryAfterMs: result.retryAfterMs,
              });
            }
            break;
          }
          continue;
        }
        out.push({ id: item.id, text: result.text });
      } catch {
        out.push({ id: item.id, error: 'offline' });
      }
    }
    return out;
  }
}

export class HttpPgnTranslationProvider implements PgnTranslationProvider {
  readonly configured = true;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  async translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]> {
    try {
      return await translateViaProxy(this.url, batch);
    } catch {
      return batch.map((item) => ({ id: item.id, error: 'offline' as const }));
    }
  }
}

export function createLivePgnTranslationProvider(): PgnTranslationProvider {
  const url = translateUrl();
  if (url) return new HttpPgnTranslationProvider(url);
  return new MyMemoryPgnTranslationProvider();
}
