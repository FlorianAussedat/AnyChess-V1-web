import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { PgnCommentTranslationStore } from '../PgnCommentTranslationStore.ts';
import { PgnTranslationQueue } from '../PgnTranslationQueue.ts';
import {
  PGN_TRANSLATE_CLIENT_BUILD,
  formatPgnTranslateProbe,
  getPgnTranslateProbeSnapshot,
  markPgnTranslateRetryStarted,
  recordPgnTranslateCall,
  resetPgnTranslateProbeForTests,
} from '../pgnTranslateProbe.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('PGN translation probe', () => {
  beforeEach(() => {
    resetPgnTranslateProbeForTests();
  });

  it('keeps lastError as in-memory only and never copies comment text or keys', () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    markPgnTranslateRetryStarted('quota');
    recordPgnTranslateCall({
      trigger: 'retry',
      httpStatus: 429,
      reason: 'rate_limited',
      retryAfterMs: 5000,
      classifiedError: 'rate_limited',
      details: 'MYMEMORY WARNING: TOO MANY REQUESTS. White occupies the centre.',
      durationMs: 120,
      backend: 'deepl',
      usageCharacterCount: 1200,
      usageCharacterLimit: 500000,
    });
    const text = formatPgnTranslateProbe(getPgnTranslateProbeSnapshot(queue));
    assert.match(text, new RegExp(`clientBuild=${PGN_TRANSLATE_CLIENT_BUILD}`));
    assert.match(text, /hasPr79Classifier=true/);
    assert.match(text, /lastErrorPersistedToDisk=false/);
    assert.match(text, /lastErrorBeforeRetry=quota/);
    assert.match(text, /httpStatus=429/);
    assert.match(text, /classifiedError=rate_limited/);
    assert.match(text, /backend=deepl/);
    assert.match(text, /usageCharacterCount=1200/);
    assert.match(text, /usageCharacterLimit=500000/);
    assert.match(text, /deeplKeyInClient=false/);
    assert.match(text, /deeplMonthlyLimitChars=500000/);
    assert.doesNotMatch(text, /White occupies/);
    assert.doesNotMatch(text, /DEEPL_API_KEY/);
    assert.doesNotMatch(text, /api\.mymemory/);
    assert.doesNotMatch(text, /q=/);
  });

  it('settings expose a copyable diagnostic and the client never embeds a DeepL key', () => {
    const settings = read('components/pgn/PgnTranslationSettingsSection.tsx');
    const live = read('lib/pgnComments/liveProvider.ts');
    const classify = read('lib/pgnComments/classifyMyMemory.ts');
    assert.match(settings, /parametres-translation-diag/);
    assert.match(settings, /formatPgnTranslateProbe/);
    assert.match(live, /recordPgnTranslateCall/);
    assert.match(live, /X-AnyChess-Client/);
    assert.match(classify, /http === 429/);
    assert.doesNotMatch(live, /api\.mymemory|DEEPL_API_KEY|api-free\.deepl/);
    assert.doesNotMatch(settings, /DEEPL_API_KEY/);
  });
});
