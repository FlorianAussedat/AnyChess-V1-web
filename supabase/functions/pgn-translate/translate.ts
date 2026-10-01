import {
  directivesUnchanged,
  protectPgnComment,
  restorePgnComment,
} from "./protect.ts";

export const ANYCHESS_TRANSLATE_CLIENT = "anychess-pgn-1";
export const TRANSLATE_MAX_ITEMS = 8;
export const TRANSLATE_MAX_CHARS_PER_ITEM = 500;
export const TRANSLATE_MAX_BODY_CHARS = 8_000;

export type DeepLUsage = {
  characterCount: number;
  characterLimit: number;
  remaining: number;
};

export type TranslateItem = { id: string; text: string; context?: string };
export type TranslateResult = { id: string; text?: string; error?: string };

export type TranslateBatchResult = {
  items: TranslateResult[];
  error?: "quota" | "rate_limited" | "offline" | "rejected" | "not_configured";
  retryAfterMs?: number;
  usage: DeepLUsage | null;
};

type DeepLTranslateError = {
  error: "quota" | "rate_limited" | "offline" | "rejected" | "not_configured";
  retryAfterMs?: number;
};

type CachedUsage = { at: number; usage: DeepLUsage };

let usageCache: CachedUsage | null = null;
const USAGE_TTL_MS = 60_000;

export function readDeepLKey(env: { get(name: string): string | undefined }): string | null {
  const key = env.get("DEEPL_API_KEY")?.trim();
  return key || null;
}

export function deepLHost(key: string): string {
  return key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

export function publicUsageSnapshot(usage: DeepLUsage | null): DeepLUsage | null {
  if (!usage) return null;
  return {
    characterCount: usage.characterCount,
    characterLimit: usage.characterLimit,
    remaining: usage.remaining,
  };
}

function clip(text: string): string {
  return text.length > TRANSLATE_MAX_CHARS_PER_ITEM
    ? text.slice(0, TRANSLATE_MAX_CHARS_PER_ITEM)
    : text;
}

function parseRetryAfterMs(raw: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 120_000);
  }
  return undefined;
}

function classifyHttp(status: number, retryAfterMs?: number): DeepLTranslateError {
  if (status === 456) return { error: "quota" };
  if (status === 429) return { error: "rate_limited", retryAfterMs: retryAfterMs ?? 5_000 };
  if (status === 401 || status === 403) return { error: "not_configured" };
  if (status >= 500) return { error: "offline" };
  return { error: "rejected" };
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

export async function fetchDeepLUsage(key: string): Promise<DeepLUsage | null> {
  const now = Date.now();
  if (usageCache && now - usageCache.at < USAGE_TTL_MS) return usageCache.usage;
  try {
    const response = await fetch(`${deepLHost(key)}/v2/usage`, {
      headers: { Authorization: `DeepL-Auth-Key ${key}` },
    });
    if (!response.ok) return usageCache?.usage ?? null;
    const usage = parseUsage(await response.json());
    if (usage) usageCache = { at: now, usage };
    return usage;
  } catch {
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
  if (usage && usage.remaining < needed) return { error: "quota" };
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
    if (!response.ok) return classifyHttp(response.status, retryAfterMs);
    const body = (await response.json()) as { translations?: { text?: string }[] };
    const out = Array.isArray(body.translations)
      ? body.translations.map((row) => row.text?.trim() ?? "")
      : [];
    if (out.length !== texts.length || out.some((text) => !text)) {
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
    return { texts: out, usage: usageCache?.usage ?? usage };
  } catch {
    return { error: "offline" };
  }
}

export function inspectTranslateRequestSize(items: { text?: string }[]): {
  itemCount: number;
  chars: number;
  tooLarge: boolean;
} {
  const slice = items.slice(0, TRANSLATE_MAX_ITEMS);
  const chars = slice.reduce((sum, item) => {
    const text = typeof item.text === "string" ? item.text : "";
    return sum + Math.min(text.length, TRANSLATE_MAX_CHARS_PER_ITEM);
  }, 0);
  return {
    itemCount: slice.length,
    chars,
    tooLarge: items.length > TRANSLATE_MAX_ITEMS || chars > TRANSLATE_MAX_BODY_CHARS,
  };
}

export async function translatePgnComments(
  items: TranslateItem[],
  key: string | null,
): Promise<TranslateBatchResult> {
  if (!key) {
    return {
      items: items.map((item) => ({ id: item.id, error: "not_configured" })),
      error: "not_configured",
      usage: null,
    };
  }

  const batch = items.slice(0, TRANSLATE_MAX_ITEMS).map((item) => ({
    id: item.id,
    text: typeof item.text === "string" ? clip(item.text) : "",
  }));
  const prepared = batch.map((item) => {
    if (!item.id || !item.text.trim()) {
      return { id: item.id, error: "rejected" as const };
    }
    const protectedText = protectPgnComment(item.text);
    return { id: item.id, original: item.text, protectedText };
  });
  const toSend = prepared.filter(
    (
      row,
    ): row is {
      id: string;
      original: string;
      protectedText: ReturnType<typeof protectPgnComment>;
    } => "protectedText" in row,
  );
  if (toSend.length === 0) {
    return {
      items: prepared.map((row) =>
        "error" in row ? { id: row.id, error: row.error } : { id: row.id, error: "rejected" },
      ),
      usage: null,
    };
  }

  const translated = await translateWithDeepL(
    toSend.map((row) => row.protectedText.masked),
    key,
  );
  if ("error" in translated) {
    return {
      items: batch.map((item) => ({ id: item.id, error: translated.error })),
      error: translated.error,
      retryAfterMs: translated.retryAfterMs,
      usage: null,
    };
  }

  const byId = new Map<string, string>();
  toSend.forEach((row, index) => {
    const restored = restorePgnComment(
      translated.texts[index] ?? "",
      row.protectedText.tokens,
    );
    if (!restored || !directivesUnchanged(row.original, restored)) return;
    byId.set(row.id, restored);
  });

  return {
    items: batch.map((item) => {
      const text = byId.get(item.id);
      if (!text) return { id: item.id, error: "rejected" };
      return { id: item.id, text };
    }),
    usage: translated.usage,
  };
}

export function resetDeepLUsageCacheForTests(): void {
  usageCache = null;
}
