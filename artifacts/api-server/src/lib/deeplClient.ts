import { logger } from "./logger.ts";

export const DEEPL_FREE_MONTHLY_LIMIT_CHARS = 500_000;
export const ANYCHESS_TRANSLATE_CLIENT = "anychess-pgn-1";

export type DeepLUsage = {
  characterCount: number;
  characterLimit: number;
  remaining: number;
};

export type DeepLTranslateError = {
  error: "quota" | "rate_limited" | "offline" | "rejected" | "not_configured";
  retryAfterMs?: number;
};

type CachedUsage = { at: number; usage: DeepLUsage };

let usageCache: CachedUsage | null = null;
const USAGE_TTL_MS = 60_000;

export function readDeepLKey(): string | null {
  const key = process.env.DEEPL_API_KEY?.trim();
  return key || null;
}

export function deepLHost(key: string): string {
  return key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
}

function safeDeepLLog(
  event: string,
  fields: Record<string, string | number | boolean | undefined | null>,
): void {
  const safe: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (/key|secret|token|authorization|comment|text|query/i.test(key)) continue;
    safe[key] = value;
  }
  logger.info({ event: `pgnTranslate.${event}`, ...safe });
}

function parseUsage(body: unknown): DeepLUsage | null {
  if (!body || typeof body !== "object") return null;
  const row = body as { character_count?: unknown; character_limit?: unknown };
  const characterCount = Number(row.character_count);
  const characterLimit = Number(row.character_limit);
  if (!Number.isFinite(characterCount) || !Number.isFinite(characterLimit)) {
    return null;
  }
  return {
    characterCount,
    characterLimit,
    remaining: Math.max(0, characterLimit - characterCount),
  };
}

function classifyHttp(status: number, retryAfterMs?: number): DeepLTranslateError {
  if (status === 456) return { error: "quota" };
  if (status === 429) return { error: "rate_limited", retryAfterMs: retryAfterMs ?? 5_000 };
  if (status === 401 || status === 403) return { error: "not_configured" };
  if (status >= 500) return { error: "offline" };
  return { error: "rejected" };
}

function parseRetryAfterMs(raw: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 120_000);
  }
  return undefined;
}

export async function fetchDeepLUsage(key: string): Promise<DeepLUsage | null> {
  const now = Date.now();
  if (usageCache && now - usageCache.at < USAGE_TTL_MS) return usageCache.usage;
  const started = Date.now();
  try {
    const response = await fetch(`${deepLHost(key)}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${key}` },
    });
    if (!response.ok) {
      safeDeepLLog("usage", { httpStatus: response.status, durationMs: Date.now() - started });
      return usageCache?.usage ?? null;
    }
    const usage = parseUsage(await response.json());
    if (usage) usageCache = { at: now, usage };
    safeDeepLLog("usage", {
      httpStatus: response.status,
      durationMs: Date.now() - started,
      characterCount: usage?.characterCount,
      characterLimit: usage?.characterLimit,
    });
    return usage;
  } catch {
    safeDeepLLog("usage", { error: "offline", durationMs: Date.now() - started });
    return usageCache?.usage ?? null;
  }
}

export async function translateWithDeepL(
  texts: string[],
  key: string,
): Promise<{ texts: string[]; usage: DeepLUsage | null } | DeepLTranslateError> {
  if (texts.length === 0) return { texts: [], usage: usageCache?.usage ?? null };
  const usage = await fetchDeepLUsage(key);
  const needed = texts.reduce((sum, text) => sum + text.length, 0);
  if (usage && usage.remaining < needed) {
    return { error: "quota" };
  }
  const started = Date.now();
  try {
    const response = await fetch(`${deepLHost(key)}/v2/translate`, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        source_lang: "EN",
        target_lang: "FR",
        preserve_formatting: true,
        tag_handling: "xml",
        ignore_tags: ["x"],
      }),
    });
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    if (!response.ok) {
      const classified = classifyHttp(response.status, retryAfterMs);
      safeDeepLLog("translate", {
        httpStatus: response.status,
        error: classified.error,
        durationMs: Date.now() - started,
        batch: texts.length,
      });
      return classified;
    }
    const body = (await response.json()) as {
      translations?: { text?: string }[];
    };
    const out = Array.isArray(body.translations)
      ? body.translations.map((row) => row.text?.trim() ?? "")
      : [];
    if (out.length !== texts.length || out.some((text) => !text)) {
      safeDeepLLog("translate", {
        httpStatus: response.status,
        error: "rejected",
        durationMs: Date.now() - started,
        batch: texts.length,
      });
      return { error: "rejected" };
    }
    if (usage) {
      usageCache = {
        at: Date.now(),
        usage: {
          characterCount: usage.characterCount + needed,
          characterLimit: usage.characterLimit,
          remaining: Math.max(0, usage.remaining - needed),
        },
      };
    }
    safeDeepLLog("translate", {
      httpStatus: response.status,
      durationMs: Date.now() - started,
      batch: texts.length,
      chars: needed,
      characterCount: usageCache?.usage.characterCount,
    });
    return { texts: out, usage: usageCache?.usage ?? usage };
  } catch {
    safeDeepLLog("translate", { error: "offline", durationMs: Date.now() - started });
    return { error: "offline" };
  }
}

export function publicUsageSnapshot(usage: DeepLUsage | null): DeepLUsage | null {
  if (!usage) return null;
  return {
    characterCount: usage.characterCount,
    characterLimit: usage.characterLimit,
    remaining: usage.remaining,
  };
}

/** Test helper. */
export function resetDeepLUsageCacheForTests(): void {
  usageCache = null;
}
