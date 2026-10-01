const MYMEMORY = "https://api.mymemory.translated.net/get";
const MAX_CHARS = 500;

export type TranslateItem = { id: string; text: string; context?: string };
export type TranslateResult = { id: string; text?: string; error?: string };

async function translateMyMemory(text: string): Promise<string | null> {
  const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  const url = `${MYMEMORY}?q=${encodeURIComponent(clipped)}&langpair=en|fr`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    responseData?: { translatedText?: string };
    responseStatus?: number | string;
  };
  if (Number(body.responseStatus) && Number(body.responseStatus) !== 200) {
    return null;
  }
  return body.responseData?.translatedText?.trim() || null;
}

async function translateDeepL(text: string, key: string): Promise<string | null> {
  const free = key.endsWith(":fx");
  const host = free ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const response = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: [text],
      source_lang: "EN",
      target_lang: "FR",
    }),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    translations?: { text?: string }[];
  };
  return body.translations?.[0]?.text?.trim() || null;
}

export async function translatePgnComments(
  items: TranslateItem[],
): Promise<TranslateResult[]> {
  const key = process.env.DEEPL_API_KEY?.trim();
  const out: TranslateResult[] = [];
  for (const item of items.slice(0, 8)) {
    if (!item.id || !item.text?.trim()) {
      out.push({ id: item.id, error: "rejected" });
      continue;
    }
    try {
      const text = key
        ? await translateDeepL(item.text, key)
        : await translateMyMemory(item.text);
      if (!text) out.push({ id: item.id, error: "rejected" });
      else out.push({ id: item.id, text });
    } catch {
      out.push({ id: item.id, error: "offline" });
    }
  }
  return out;
}

export function translationBackend(): "deepl" | "mymemory" {
  return process.env.DEEPL_API_KEY?.trim() ? "deepl" : "mymemory";
}
