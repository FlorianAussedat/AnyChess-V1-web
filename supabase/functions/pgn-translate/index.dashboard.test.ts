import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const index = readFileSync(join(here, "index.ts"), "utf8");

describe("dashboard pgn-translate source", () => {
  it("is a single file with no local imports and requires a signed-in user", () => {
    assert.doesNotMatch(index, /from ["']\.\//);
    assert.match(index, /requireSignedInUser/);
    assert.match(index, /role === "anon"/);
    assert.match(index, /role !== "authenticated"/);
    assert.match(index, /SUPABASE_ANON_KEY/);
    assert.match(index, /auth\/v1\/user/);
    assert.match(index, /token === anon/);
    assert.match(index, /x-anychess-client/);
    assert.match(index, /DEEPL_API_KEY/);
    assert.doesNotMatch(index, /console\.log/);
    assert.match(index, /Deno\.serve/);
  });
});
