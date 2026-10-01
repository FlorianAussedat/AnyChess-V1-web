import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLivePgnTranslationProvider,
  resolvePgnTranslateUrl,
} from '../liveProvider.ts';
import { UnconfiguredPgnTranslationProvider } from '../unconfiguredProvider.ts';
import { HttpPgnTranslationProvider } from '../liveProvider.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('DeepL proxy URL', () => {
  it('prefers the Supabase Edge Function and never reads a DeepL key', () => {
    const previous = {
      EXPO_PUBLIC_PGN_TRANSLATE_URL: process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL,
      EXPO_PUBLIC_DOMAIN: process.env.EXPO_PUBLIC_DOMAIN,
      ANYCHESS_PGN_TRANSLATE_URL: process.env.ANYCHESS_PGN_TRANSLATE_URL,
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      ANYCHESS_SUPABASE_URL: process.env.ANYCHESS_SUPABASE_URL,
    };
    try {
      delete process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL;
      delete process.env.EXPO_PUBLIC_DOMAIN;
      delete process.env.ANYCHESS_PGN_TRANSLATE_URL;
      delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      delete process.env.ANYCHESS_SUPABASE_URL;
      assert.equal(resolvePgnTranslateUrl(), null);
      assert.ok(createLivePgnTranslationProvider() instanceof UnconfiguredPgnTranslationProvider);

      process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://zqfxnzwtptepulmgpxhb.supabase.co';
      assert.equal(
        resolvePgnTranslateUrl(),
        'https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/pgn-translate',
      );
      assert.ok(createLivePgnTranslationProvider() instanceof HttpPgnTranslationProvider);

      process.env.EXPO_PUBLIC_DOMAIN = 'example.replit.app';
      assert.equal(
        resolvePgnTranslateUrl(),
        'https://zqfxnzwtptepulmgpxhb.supabase.co/functions/v1/pgn-translate',
      );

      process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL =
        'https://example.replit.app/api/pgn-comments/translate/';
      assert.equal(
        resolvePgnTranslateUrl(),
        'https://example.replit.app/api/pgn-comments/translate',
      );
      assert.equal(process.env.DEEPL_API_KEY, undefined);
    } finally {
      for (const [name, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it('keeps EXPO_PUBLIC_SUPABASE_* as static identifiers for Metro', () => {
    const live = readFileSync(join(here, '../liveProvider.ts'), 'utf8');
    assert.match(live, /process\.env\.EXPO_PUBLIC_SUPABASE_URL/);
    assert.match(live, /process\.env\.EXPO_PUBLIC_SUPABASE_ANON_KEY/);
    assert.match(live, /functions\/v1\/\$\{PGN_TRANSLATE_FUNCTION\}/);
    assert.match(live, /getAccessToken/);
    assert.match(live, /userToken !== anon/);
    assert.doesNotMatch(live, /DEEPL_API_KEY|api-free\.deepl/);
    assert.doesNotMatch(live, /Authorization: `Bearer \$\{anon\}`/);
  });
});
