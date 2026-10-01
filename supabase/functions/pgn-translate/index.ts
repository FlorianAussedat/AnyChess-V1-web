import {
  ANYCHESS_TRANSLATE_CLIENT,
  fetchDeepLUsage,
  inspectTranslateRequestSize,
  publicUsageSnapshot,
  readDeepLKey,
  translatePgnComments,
} from "./translate.ts";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-anychess-client, x-anychess-translate-token",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hasValidClient(req: Request): boolean {
  return req.headers.get("x-anychess-client") === ANYCHESS_TRANSLATE_CLIENT;
}

function translationBackend(key: string | null): "deepl" | "not_configured" {
  return key ? "deepl" : "not_configured";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!hasValidClient(req)) {
    return json({ error: "rejected" }, 401);
  }

  const key = readDeepLKey(Deno.env);

  if (req.method === "GET") {
    if (!key) {
      return json(
        { backend: "not_configured", error: "not_configured", usage: null },
        503,
      );
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
  if (items.length === 0) {
    return json({ error: "items_required" }, 400);
  }
  const size = inspectTranslateRequestSize(items as { text?: string }[]);
  if (size.tooLarge) {
    return json({ error: "rejected" }, 413);
  }

  const result = await translatePgnComments(
    items as { id: string; text: string; context?: string }[],
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
      backend: translationBackend(key),
      error: result.error,
      retryAfterMs: result.retryAfterMs,
      usage: publicUsageSnapshot(result.usage),
      items: result.items,
    },
    status,
  );
});
