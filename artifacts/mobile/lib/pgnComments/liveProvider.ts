/**
 * Live EN→FR provider. Default path: MyMemory public API (no client secret).
 * Optional hosted proxy: ANYCHESS_PGN_TRANSLATE_URL (public URL, not a key).
 */
import { protectChessTerms, restoreChessTerms } from './chessGlossary.ts';
import {
  protectCommentTokens,
  restoreCommentTokens,
  tokensUnchanged,
} from './protectTokens.ts';
import type { PgnTranslationProvider, PgnTranslationProviderResult } from './types.ts';

const MYMEMORY = 'https://api.mymemory.translated.net/get';
const MAX_CHARS = 500;

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
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ items: batch }),
  });
  if (!response.ok) {
    return batch.map((item) => ({ id: item.id, error: 'offline' as const }));
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

function isQuotaMessage(text: string | undefined, status: number, quotaFinished?: boolean): boolean {
  if (quotaFinished) return true;
  if (status === 429 || status === 403) return true;
  return Boolean(text && /YOU USED ALL AVAILABLE FREE TRANSLATIONS/i.test(text));
}

export async function translateViaMyMemory(
  text: string,
): Promise<{ text: string } | { error: 'quota' | 'offline' | 'rejected' }> {
  const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  const url = `${MYMEMORY}?q=${encodeURIComponent(clipped)}&langpair=en|fr`;
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    return { error: 'offline' };
  }
  if (response.status === 429 || response.status === 403) return { error: 'quota' };
  if (!response.ok) return { error: 'offline' };
  const body = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
    quotaFinished?: boolean;
    responseDetails?: string;
  };
  const status = Number(body.responseStatus);
  const translated = body.responseData?.translatedText?.trim();
  if (isQuotaMessage(translated ?? body.responseDetails, status, body.quotaFinished)) {
    return { error: 'quota' };
  }
  if (status && status !== 200) return { error: 'rejected' };
  if (!translated) return { error: 'rejected' };
  return { text: translated };
}

export async function translateEnglishComment(
  original: string,
): Promise<{ text: string } | { error: 'quota' | 'offline' | 'rejected' | 'invalid' }> {
  const protectedText = protectCommentTokens(original);
  const glossed = protectChessTerms(protectedText.masked);
  const translated = await translateViaMyMemory(glossed.masked);
  if ('error' in translated) return translated;
  const withTerms = restoreChessTerms(translated.text, glossed.terms);
  const restored = restoreCommentTokens(withTerms, protectedText.tokens);
  if (!tokensUnchanged(original, restored)) return { error: 'invalid' };
  return { text: restored };
}

export class MyMemoryPgnTranslationProvider implements PgnTranslationProvider {
  readonly configured = true;

  async translateComments(
    batch: { id: string; text: string; context?: string }[],
  ): Promise<PgnTranslationProviderResult[]> {
    const out: PgnTranslationProviderResult[] = [];
    for (const item of batch) {
      try {
        const result = await translateEnglishComment(item.text);
        if ('error' in result) {
          out.push({ id: item.id, error: result.error });
          if (result.error === 'quota' || result.error === 'offline') {
            const rest = batch.slice(out.length);
            for (const leftover of rest) out.push({ id: leftover.id, error: result.error });
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
