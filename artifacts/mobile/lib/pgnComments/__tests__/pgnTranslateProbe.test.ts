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

  it('keeps lastError as in-memory only and never copies comment text', () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    markPgnTranslateRetryStarted('quota');
    recordPgnTranslateCall({
      trigger: 'retry',
      httpStatus: 200,
      responseStatus: 429,
      quotaFinished: false,
      reason: 'body429',
      retryAfterMs: 5000,
      classifiedError: 'rate_limited',
      details: 'MYMEMORY WARNING: TOO MANY REQUESTS. White occupies the centre.',
      durationMs: 120,
    });
    const text = formatPgnTranslateProbe(getPgnTranslateProbeSnapshot(queue));
    assert.match(text, new RegExp(`clientBuild=${PGN_TRANSLATE_CLIENT_BUILD}`));
    assert.match(text, /hasPr79Classifier=true/);
    assert.match(text, /lastErrorPersistedToDisk=false/);
    assert.match(text, /lastErrorBeforeRetry=quota/);
    assert.match(text, /httpStatus=200/);
    assert.match(text, /responseStatus=429/);
    assert.match(text, /quotaFinished=false/);
    assert.match(text, /reason=body429/);
    assert.match(text, /retryAfterMs=5000/);
    assert.match(text, /classifiedError=rate_limited/);
    assert.match(text, /detailsHasOfficialQuotaText=false/);
    assert.doesNotMatch(text, /White occupies/);
    assert.doesNotMatch(text, /MYMEMORY WARNING/);
    assert.doesNotMatch(text, /centre/);
    assert.doesNotMatch(text, /api\.mymemory/);
    assert.doesNotMatch(text, /q=/);
  });

  it('marks official quota text without storing it', () => {
    const kv = new MemoryKeyValueStorage();
    const store = new PgnCommentTranslationStore(kv);
    const queue = new PgnTranslationQueue(kv, store);
    recordPgnTranslateCall({
      httpStatus: 200,
      responseStatus: 429,
      quotaFinished: true,
      reason: 'quotaFinished',
      classifiedError: 'quota',
      details: 'YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY',
    });
    const text = formatPgnTranslateProbe(getPgnTranslateProbeSnapshot(queue));
    assert.match(text, /quotaFinished=true/);
    assert.match(text, /detailsHasOfficialQuotaText=true/);
    assert.doesNotMatch(text, /YOU USED ALL AVAILABLE/);
  });

  it('settings expose a copyable diagnostic and retry does not change classify rules', () => {
    const settings = read('components/pgn/PgnTranslationSettingsSection.tsx');
    const live = read('lib/pgnComments/liveProvider.ts');
    const classify = read('lib/pgnComments/classifyMyMemory.ts');
    assert.match(settings, /parametres-translation-diag/);
    assert.match(settings, /formatPgnTranslateProbe/);
    assert.match(live, /recordPgnTranslateCall/);
    assert.match(classify, /isExhaustedQuotaSignal/);
    assert.match(classify, /http === 429/);
  });
});
