import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createLivePgnTranslationProvider,
  resolvePgnTranslateUrl,
} from '../liveProvider.ts';
import { UnconfiguredPgnTranslationProvider } from '../unconfiguredProvider.ts';
import { HttpPgnTranslationProvider } from '../liveProvider.ts';

describe('DeepL proxy URL', () => {
  it('stays unconfigured without a public URL and never reads a DeepL key', () => {
    const previousUrl = process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL;
    const previousDomain = process.env.EXPO_PUBLIC_DOMAIN;
    const previousAny = process.env.ANYCHESS_PGN_TRANSLATE_URL;
    try {
      delete process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL;
      delete process.env.EXPO_PUBLIC_DOMAIN;
      delete process.env.ANYCHESS_PGN_TRANSLATE_URL;
      assert.equal(resolvePgnTranslateUrl(), null);
      assert.ok(createLivePgnTranslationProvider() instanceof UnconfiguredPgnTranslationProvider);
      process.env.EXPO_PUBLIC_DOMAIN = 'example.replit.app';
      assert.equal(
        resolvePgnTranslateUrl(),
        'https://example.replit.app/api/pgn-comments/translate',
      );
      process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL =
        'https://example.replit.app/api/pgn-comments/translate/';
      assert.equal(
        resolvePgnTranslateUrl(),
        'https://example.replit.app/api/pgn-comments/translate',
      );
      assert.ok(createLivePgnTranslationProvider() instanceof HttpPgnTranslationProvider);
      assert.equal(process.env.DEEPL_API_KEY, undefined);
    } finally {
      if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL;
      else process.env.EXPO_PUBLIC_PGN_TRANSLATE_URL = previousUrl;
      if (previousDomain === undefined) delete process.env.EXPO_PUBLIC_DOMAIN;
      else process.env.EXPO_PUBLIC_DOMAIN = previousDomain;
      if (previousAny === undefined) delete process.env.ANYCHESS_PGN_TRANSLATE_URL;
      else process.env.ANYCHESS_PGN_TRANSLATE_URL = previousAny;
    }
  });
});
