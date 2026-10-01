/**
 * Live EN→FR provider. Production path: the hosted AnyChess proxy
 * (DeepL API Free on the server). The DeepL key never enters this bundle.
 */
import { UnconfiguredPgnTranslationProvider } from './unconfiguredProvider.ts';
import { classifyMyMemoryResponse, logPgnTranslate, parseRetryAfterMs } from './classifyMyMemory.ts';
import { recordPgnTranslateCall } from './pgnTranslateProbe.ts';
import { isEchoTranslation } from './fingerprint.ts';
import { tokensUnchanged } from './protectTokens.ts';
import type { PgnTranslationProvider, PgnTranslationProviderResult } from './types.ts';

const REQUEST_TIMEOUT_MS = 15_000;
export const ANYCHESS_TRANSLATE_CLIENT = 'anychess-pgn-1';

let translationHold = false;

export function setPgnTranslationHold(hold: boolean): void {
  translationHold = hold;
}

export function isPgnTranslationHeld(): boolean {
  return translationHold;
}

function firstEnv(...names: string[]): string | null {
  if (typeof process === 'undefined') return null;
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

function hostFromDomain(domain: string): string {
  return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

/** Public URL only — never a DeepL key. */
export function resolvePgnTranslateUrl(): string | null {
  const explicit = firstEnv('EXPO_PUBLIC_PGN_TRANSLATE_URL', 'ANYCHESS_PGN_TRANSLATE_URL');
  if (explicit) return explicit.replace(/\/$/, '');
  const domain = firstEnv('EXPO_PUBLIC_DOMAIN');
  if (!domain) return null;
  return `https://${hostFromDomain(domain)}/api/pgn-comments/translate`;
}

function translateToken(): string | null {
  return firstEnv('EXPO_PUBLIC_PGN_TRANSLATE_TOKEN', 'ANYCHESS_TRANSLATE_APP_TOKEN');
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

function classifyProxyStatus(httpStatus: number, bodyError?: string): PgnTranslationProviderResult['error'] {
  if (bodyError === 'quota' || httpStatus === 456) return 'quota';
  if (bodyError === 'rate_limited' || httpStatus === 429) return 'rate_limited';
  if (bodyError === 'not_configured' || httpStatus === 401 || httpStatus === 403) {
    return 'not_configured';
  }
  if (bodyError === 'offline' || httpStatus === 503) {
    return bodyError === 'not_configured' ? 'not_configured' : 'offline';
  }
  if (bodyError === 'timeout') return 'timeout';
  const classified = classifyMyMemoryResponse({ httpStatus });
  if (classified.error === 'rate_limited') return 'rate_limited';
  if (classified.error === 'quota') return 'quota';
  return classified.error === 'timeout' ? 'timeout' : classified.error === 'offline' ? 'offline' : 'rejected';
}

type ProxyUsage = {
  characterCount: number;
  characterLimit: number;
  remaining: number;
};

export async function translateViaProxy(
  url: string,
  batch: { id: string; text: string; context?: string }[],
): Promise<PgnTranslationProviderResult[]> {
  const started = Date.now();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-AnyChess-Client': ANYCHESS_TRANSLATE_CLIENT,
  };
  const token = translateToken();
  if (token) headers['X-AnyChess-Translate-Token'] = token;
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ items: batch }),
    });
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'AbortError');
    recordPgnTranslateCall({
      classifiedError: aborted ? 'timeout' : 'offline',
      reason: aborted ? 'aborted' : 'network',
      durationMs: Date.now() - started,
    });
    return batch.map((item) => ({ id: item.id, error: aborted ? 'timeout' : 'offline' }));
  }

  let body: {
    error?: string;
    retryAfterMs?: number;
    usage?: ProxyUsage | null;
    items?: { id?: string; text?: string; error?: string }[];
    backend?: string;
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = {};
  }
  const retryAfterMs =
    typeof body.retryAfterMs === 'number'
      ? body.retryAfterMs
      : parseRetryAfterMs(response.headers.get('retry-after'));
  const classified = classifyProxyStatus(response.status, body.error);
  logPgnTranslate('proxy', {
    httpStatus: response.status,
    durationMs: Date.now() - started,
    batch: batch.length,
    error: body.error,
    backend: body.backend,
    characterCount: body.usage?.characterCount,
    characterLimit: body.usage?.characterLimit,
  });
  recordPgnTranslateCall({
    httpStatus: response.status,
    classifiedError: response.ok && !body.error ? 'ok' : classified,
    reason: body.error ?? (response.ok ? 'ok' : `http${response.status}`),
    retryAfterMs,
    durationMs: Date.now() - started,
    usageCharacterCount: body.usage?.characterCount,
    usageCharacterLimit: body.usage?.characterLimit,
    backend: body.backend,
  });

  if (body.error === 'quota' || body.error === 'rate_limited' || body.error === 'offline' || body.error === 'not_configured' || body.error === 'timeout') {
    return batch.map((item) => ({
      id: item.id,
      error: body.error as PgnTranslationProviderResult['error'],
      retryAfterMs,
    }));
  }
  if (!response.ok) {
    return batch.map((item) => ({
      id: item.id,
      error: classified,
      retryAfterMs,
    }));
  }

  const rows = Array.isArray(body.items) ? body.items : [];
  return batch.map((item) => {
    const row = rows.find((entry) => entry.id === item.id);
    if (row?.error === 'quota' || row?.error === 'rate_limited' || row?.error === 'offline' || row?.error === 'not_configured' || row?.error === 'timeout' || row?.error === 'rejected' || row?.error === 'invalid') {
      return { id: item.id, error: row.error, retryAfterMs };
    }
    if (!row?.text) return { id: item.id, error: 'rejected' as const };
    if (!tokensUnchanged(item.text, row.text)) {
      return { id: item.id, error: 'invalid' as const };
    }
    if (isEchoTranslation(item.text, row.text)) {
      return { id: item.id, error: 'rejected' as const };
    }
    return { id: item.id, text: row.text };
  });
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
    if (isPgnTranslationHeld()) {
      return batch.map((item) => ({ id: item.id, error: 'held' as const }));
    }
    try {
      return await translateViaProxy(this.url, batch);
    } catch {
      return batch.map((item) => ({ id: item.id, error: 'offline' as const }));
    }
  }
}

export function createLivePgnTranslationProvider(): PgnTranslationProvider {
  const url = resolvePgnTranslateUrl();
  if (!url) return new UnconfiguredPgnTranslationProvider();
  return new HttpPgnTranslationProvider(url);
}
