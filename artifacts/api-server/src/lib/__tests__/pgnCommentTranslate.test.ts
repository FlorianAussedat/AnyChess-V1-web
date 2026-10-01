import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  protectPgnComment,
  restorePgnComment,
  directivesUnchanged,
  glossChessTerms,
} from "../protectPgnComment.ts";
import { translatePgnComments } from "../pgnCommentTranslate.ts";
import {
  resetDeepLUsageCacheForTests,
  deepLHost,
} from "../deeplClient.ts";
import {
  consumeTranslateQuota,
  inspectTranslateRequestSize,
  resetTranslateRateLimitForTests,
  TRANSLATE_REQ_PER_MIN,
} from "../translateRateLimit.ts";

const SAMPLE = [
  "White occupies the center.",
  "White develops the knight toward the center.",
  "[%eval 0.12] Black answers in kind.",
  "After Nf3 White prepares d4.",
];

function mockFetch(
  handler: (url: string, init?: RequestInit) => Promise<Response> | Response,
): void {
  globalThis.fetch = handler as typeof fetch;
}

describe("PGN comment protection", () => {
  it("keeps SAN, eval and chess vocabulary out of the DeepL payload", () => {
    const raw = "After Nf3 [%eval 0.20] White develops the knight.";
    const protectedText = protectPgnComment(raw);
    assert.doesNotMatch(protectedText.masked, /Nf3|[%]|knight|White/);
    assert.match(protectedText.masked, /<x i="0"\/>/);
    assert.match(protectedText.masked, /cavalier/);
    assert.match(protectedText.masked, /les Blancs/);
    const restored = restorePgnComment(
      "Après <x i=\"1\"/> <x i=\"0\"/> les Blancs développent le cavalier.",
      protectedText.tokens,
    );
    assert.match(restored, /Nf3/);
    assert.match(restored, /\[%eval 0\.20\]/);
    assert.equal(directivesUnchanged(raw, restored), true);
  });

  it("glosses piece names to official French", () => {
    assert.match(glossChessTerms("White pins the knight"), /les Blancs/);
    assert.match(glossChessTerms("White pins the knight"), /cavalier/);
    assert.match(glossChessTerms("White pins the knight"), /clouage/);
  });
});

describe("DeepL host and request limits", () => {
  it("uses the Free host for :fx keys", () => {
    assert.equal(deepLHost("abc:fx"), "https://api-free.deepl.com");
    assert.equal(deepLHost("abc"), "https://api.deepl.com");
  });

  it("caps batch size and daily characters per IP", () => {
    const size = inspectTranslateRequestSize(
      Array.from({ length: 3 }, (_, i) => ({ text: `hello ${i}` })),
    );
    assert.equal(size.itemCount, 3);
    resetTranslateRateLimitForTests();
    for (let i = 0; i < TRANSLATE_REQ_PER_MIN; i += 1) {
      assert.equal(consumeTranslateQuota("1.1.1.1", 1, 10).ok, true);
    }
    const blocked = consumeTranslateQuota("1.1.1.1", 1, 10);
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.reason, "rate_limited");
  });
});

describe("translatePgnComments via DeepL", () => {
  const previousKey = process.env.DEEPL_API_KEY;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    resetDeepLUsageCacheForTests();
    process.env.DEEPL_API_KEY = "test-key:fx";
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.DEEPL_API_KEY;
    else process.env.DEEPL_API_KEY = previousKey;
    globalThis.fetch = originalFetch;
  });

  it("returns not_configured without a server key", async () => {
    delete process.env.DEEPL_API_KEY;
    const result = await translatePgnComments([
      { id: "a", text: "White occupies the center." },
    ]);
    assert.equal(result.error, "not_configured");
    assert.equal(result.items[0]?.error, "not_configured");
  });

  it("maps DeepL 456 to quota and never echoes the key", async () => {
    mockFetch(async (url) => {
      assert.match(String(url), /api-free\.deepl\.com/);
      assert.doesNotMatch(String(url), /test-key/);
      if (String(url).endsWith("/v2/usage")) {
        return new Response(
          JSON.stringify({ character_count: 10, character_limit: 500000 }),
          { status: 200 },
        );
      }
      return new Response("quota", { status: 456 });
    });
    const result = await translatePgnComments([
      { id: "a", text: "White occupies the center." },
    ]);
    assert.equal(result.error, "quota");
  });

  it("maps 429 to rate_limited and network failures to offline", async () => {
    mockFetch(async (url) => {
      if (String(url).endsWith("/v2/usage")) {
        return new Response(
          JSON.stringify({ character_count: 10, character_limit: 500000 }),
          { status: 200 },
        );
      }
      return new Response("slow", { status: 429, headers: { "retry-after": "8" } });
    });
    const limited = await translatePgnComments([
      { id: "a", text: "White occupies the center." },
    ]);
    assert.equal(limited.error, "rate_limited");
    assert.equal(limited.retryAfterMs, 8_000);

    mockFetch(async () => {
      throw new Error("network down");
    });
    const offline = await translatePgnComments([
      { id: "a", text: "White occupies the center." },
    ]);
    assert.equal(offline.error, "offline");
  });

  it("translates chess comments while preserving SAN and eval", async () => {
    mockFetch(async (url, init) => {
      if (String(url).endsWith("/v2/usage")) {
        return new Response(
          JSON.stringify({ character_count: 1200, character_limit: 500000 }),
          { status: 200 },
        );
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { text: string[] };
      assert.equal(body.text.length, 4);
      for (const text of body.text) {
        assert.doesNotMatch(text, /Nf3|d4|[%]eval|knight|White|Black/);
      }
      return new Response(
        JSON.stringify({
          translations: [
            { text: "Les Blancs occupent le centre." },
            { text: "Les Blancs développent le cavalier vers le centre." },
            { text: '<x i="0"/> Les Noirs répondent de la même façon.' },
            { text: 'Après <x i="0"/> les Blancs préparent <x i="1"/>.' },
          ],
        }),
        { status: 200 },
      );
    });
    const result = await translatePgnComments(
      SAMPLE.map((text, index) => ({ id: `c${index}`, text })),
    );
    assert.equal(result.error, undefined);
    assert.equal(result.items[0]?.text, "Les Blancs occupent le centre.");
    assert.match(result.items[1]?.text ?? "", /cavalier/);
    assert.match(result.items[2]?.text ?? "", /\[%eval 0\.12\]/);
    assert.match(result.items[3]?.text ?? "", /Nf3/);
    assert.match(result.items[3]?.text ?? "", /d4/);
    assert.ok((result.usage?.characterCount ?? 0) > 1200);
    assert.equal(result.usage?.characterLimit, 500000);
  });

  it("refuses to send the DeepL key in results", async () => {
    const result = await translatePgnComments([]);
    assert.doesNotMatch(JSON.stringify(result), /test-key|DEEPL_API_KEY/);
  });
});
