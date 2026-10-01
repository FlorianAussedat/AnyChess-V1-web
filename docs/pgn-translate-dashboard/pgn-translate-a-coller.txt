/**
 * AnyChess PGN comment translation — Supabase Edge Function (single file).
 *
 * Paste this entire file into the Dashboard editor as function `pgn-translate`.
 * No local imports. DeepL key: Edge Function secret DEEPL_API_KEY.
 *
 * Auth: a signed-in user JWT is required. The public anon key is rejected,
 * even with X-AnyChess-Client. JWT verification must stay enabled.
 */

const CLIENT = "anychess-pgn-1";
const TRANSLATE_MAX_ITEMS = 8;
const TRANSLATE_MAX_CHARS_PER_ITEM = 500;
const TRANSLATE_MAX_BODY_CHARS = 8_000;
const USAGE_TTL_MS = 60_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-anychess-client, x-anychess-translate-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

type DeepLUsage = {
  characterCount: number;
  characterLimit: number;
  remaining: number;
};

type TranslateItem = { id: string; text: string };
type TranslateResult = { id: string; text?: string; error?: string };
type TranslateBatchResult = {
  items: TranslateResult[];
  error?: "quota" | "rate_limited" | "offline" | "rejected" | "not_configured";
  retryAfterMs?: number;
  usage: DeepLUsage | null;
};

type JwtPayload = { sub?: string; role?: string; iss?: string };

const DIRECTIVE_RE = /\[%[^\]]+\]/g;
const FEN_RE =
  /\b(?:[rnbqkpRNBQKP1-8]+\/){7}[rnbqkpRNBQKP1-8]+(?: [wb] [KQkq-]+ [a-h1-8-] \d+ \d+)?\b/g;
const SAN_RE =
  /\b(?:[NBRQK][a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?|[a-h]x?[a-h]?[1-8](?:=[NBRQ])?[+#]?|O-O-O|O-O)\b/g;

const TERMS: { pattern: RegExp; fr: string }[] = [
  { pattern: /\bcheckmates?\b/gi, fr: "mat" },
  { pattern: /\bcastling\b/gi, fr: "roque" },
  { pattern: /\bknights\b/gi, fr: "cavaliers" },
  { pattern: /\bknight\b/gi, fr: "cavalier" },
  { pattern: /\bbishops\b/gi, fr: "fous" },
  { pattern: /\bbishop\b/gi, fr: "fou" },
  { pattern: /\brooks\b/gi, fr: "tours" },
  { pattern: /\brook\b/gi, fr: "tour" },
  { pattern: /\bqueens\b/gi, fr: "dames" },
  { pattern: /\bqueen\b/gi, fr: "dame" },
  { pattern: /\bkings\b/gi, fr: "rois" },
  { pattern: /\bking\b/gi, fr: "roi" },
  { pattern: /\bpawns\b/gi, fr: "pions" },
  { pattern: /\bpawn\b/gi, fr: "pion" },
  { pattern: /\bpins\b/gi, fr: "clouages" },
  { pattern: /\bpin\b/gi, fr: "clouage" },
  { pattern: /\bforks\b/gi, fr: "fourchettes" },
  { pattern: /\bfork\b/gi, fr: "fourchette" },
  { pattern: /\bWhite\b/g, fr: "les Blancs" },
  { pattern: /\bBlack\b/g, fr: "les Noirs" },
];

let usageCache: { at: number; usage: DeepLUsage } | null = null;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readDeepLKey(): string | null {
  const key = Deno.env.get("DEEPL_API_KEY")?.trim();
  return key || null;
}

function deepLHost(key: string): string {
  return key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
}

function publicUsageSnapshot(usage: DeepLUsage | null): DeepLUsage | null {
  if (!usage) return null;
  return {
    characterCount: usage.characterCount,
    characterLimit: usage.characterLimit,
    remaining: usage.remaining,
  };
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  return token || null;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return JSON.parse(atob(padded + pad)) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Anon JWT and missing session must never reach DeepL.
 * Gateway verify_jwt accepts the anon key; this rejects it.
 */
async function requireSignedInUser(req: Request): Promise<string | null> {
  const token = bearerToken(req);
  const anon = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  if (!token || (anon && token === anon)) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  if (payload.role === "anon" || payload.role === "service_role") return null;
  if (payload.role !== "authenticated") return null;
  if (!payload.sub || !UUID_RE.test(payload.sub)) return null;

  const url = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  if (!url) return null;
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anon || token,
      },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: string };
    if (!user?.id || user.id !== payload.sub) return null;
    return user.id;
  } catch {
    return null;
  }
}

function glossChessTerms(text: string): string {
  let out = text;
  for (const term of TERMS) out = out.replace(term.pattern, term.fr);
  return out.replace(/\bchevaliers\b/gi, "cavaliers").replace(/\bchevalier\b/gi, "cavalier");
}

function protectPgnComment(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const mask = (match: string) => {
    const idx = tokens.length;
    tokens.push(match);
    return `<x i="${idx}"/>`;
  };
  let masked = text.replace(DIRECTIVE_RE, mask);
  masked = masked.replace(FEN_RE, mask);
  masked = masked.replace(SAN_RE, mask);
  return { masked: glossChessTerms(masked), tokens };
}

function restorePgnComment(masked: string, tokens: readonly string[]): string {
  return masked
    .replace(/<x i="(\d+)"\s*\/>/g, (_, raw: string) => tokens[Number(raw)] ?? "")
    .replace(/\bchevaliers\b/gi, "cavaliers")
    .replace(/\bchevalier\b/gi, "cavalier");
}

function directivesUnchanged(original: string, translated: string): boolean {
  const a = original.match(DIRECTIVE_RE) ?? [];
  const b = translated.match(DIRECTIVE_RE) ?? [];
  if (a.length !== b.length) return false;
  return a.every((token, i) => token === b[i]);
}

function clip(text: string): string {
  return text.length > TRANSLATE_MAX_CHARS_PER_ITEM
    ? text.slice(0, TRANSLATE_MAX_CHARS_PER_ITEM)
    : text;
}

function inspectTranslateRequestSize(items: { text?: string }[]): {
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

function parseRetryAfterMs(raw: string | null): number | undefined {
  if (!raw?.trim()) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 120_000);
  }
  return undefined;
}

function classifyHttp(
  status: number,
  retryAfterMs?: number,
): { error: TranslateBatchResult["error"]; retryAfterMs?: number } {
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
  if (!Number.isFinite(characterCount) || !Number.isFinite(characterLimit)) return null;
  return {
    characterCount,
    characterLimit,
    remaining: Math.max(0, characterLimit - characterCount),
  };
}

async function fetchDeepLUsage(key: string): Promise<DeepLUsage | null> {
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

async function translateWithDeepL(
  texts: string[],
  key: string,
): Promise<{ texts: string[]; usage: DeepLUsage | null } | { error: TranslateBatchResult["error"]; retryAfterMs?: number }> {
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
    if (out.length !== texts.length || out.some((text) => !text)) return { error: "rejected" };
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

async function translatePgnComments(
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
    if (!item.id || !item.text.trim()) return { id: item.id, error: "rejected" as const };
    return { id: item.id, original: item.text, protectedText: protectPgnComment(item.text) };
  });
  const toSend = prepared.filter(
    (row): row is { id: string; original: string; protectedText: ReturnType<typeof protectPgnComment> } =>
      "protectedText" in row,
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
    const restored = restorePgnComment(translated.texts[index] ?? "", row.protectedText.tokens);
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const userId = await requireSignedInUser(req);
  if (!userId) {
    return json({ error: "rejected" }, 401);
  }
  if (req.headers.get("x-anychess-client") !== CLIENT) {
    return json({ error: "rejected" }, 401);
  }

  const key = readDeepLKey();
  if (req.method === "GET") {
    if (!key) {
      return json({ backend: "not_configured", error: "not_configured", usage: null }, 503);
    }
    const usage = await fetchDeepLUsage(key);
    return json({ backend: "deepl", usage: publicUsageSnapshot(usage) });
  }
  if (req.method !== "POST") {
    return json({ error: "rejected" }, 405);
  }

  let payload: { items?: unknown } = {};
  try {
    payload = (await req.json()) as { items?: unknown };
  } catch {
    return json({ error: "items_required" }, 400);
  }
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) return json({ error: "items_required" }, 400);
  const size = inspectTranslateRequestSize(items as { text?: string }[]);
  if (size.tooLarge) return json({ error: "rejected" }, 413);

  const result = await translatePgnComments(
    items as TranslateItem[],
    key,
  );
  const status =
    result.error === "not_configured"
      ? 503
      : result.error === "quota"
        ? 456
        : result.error === "rate_limited"
          ? 429
          : result.error === "offline"
            ? 503
            : 200;
  return json(
    {
      backend: key ? "deepl" : "not_configured",
      error: result.error,
      retryAfterMs: result.retryAfterMs,
      usage: publicUsageSnapshot(result.usage),
      items: result.items,
    },
    status,
  );
});
