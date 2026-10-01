import { translateWithDeepL, readDeepLKey, type DeepLUsage } from "./deeplClient.ts";
import {
  directivesUnchanged,
  protectPgnComment,
  restorePgnComment,
} from "./protectPgnComment.ts";
import {
  TRANSLATE_MAX_CHARS_PER_ITEM,
  TRANSLATE_MAX_ITEMS,
} from "./translateRateLimit.ts";

export type TranslateItem = { id: string; text: string; context?: string };
export type TranslateResult = { id: string; text?: string; error?: string };

export type TranslateBatchResult = {
  items: TranslateResult[];
  error?: "quota" | "rate_limited" | "offline" | "rejected" | "not_configured";
  retryAfterMs?: number;
  usage: DeepLUsage | null;
};

function clip(text: string): string {
  return text.length > TRANSLATE_MAX_CHARS_PER_ITEM
    ? text.slice(0, TRANSLATE_MAX_CHARS_PER_ITEM)
    : text;
}

export async function translatePgnComments(
  items: TranslateItem[],
): Promise<TranslateBatchResult> {
  const key = readDeepLKey();
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

export function translationBackend(): "deepl" | "not_configured" {
  return readDeepLKey() ? "deepl" : "not_configured";
}
