import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyMyMemoryResponse,
  isExhaustedQuotaSignal,
  parseRetryAfterMs,
} from '../classifyMyMemory.ts';

describe('MyMemory quota vs rate limit', () => {
  it('does not treat HTTP 429 alone as an exhausted quota', () => {
    const classified = classifyMyMemoryResponse({ httpStatus: 429 });
    assert.equal(classified.error, 'rate_limited');
    assert.equal(classified.reason, 'http429');
    assert.ok((classified.retryAfterMs ?? 0) > 0);
  });

  it('does not treat a JSON responseStatus 429 as quota without proof', () => {
    const classified = classifyMyMemoryResponse({
      httpStatus: 200,
      responseStatus: 429,
    });
    assert.equal(classified.error, 'rate_limited');
    assert.equal(classified.reason, 'body429');
  });

  it('requires quotaFinished or the official daily-limit text', () => {
    assert.equal(isExhaustedQuotaSignal(undefined, false), false);
    assert.equal(isExhaustedQuotaSignal('MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY', false), true);
    assert.equal(isExhaustedQuotaSignal(undefined, true), true);
    const quota = classifyMyMemoryResponse({
      httpStatus: 200,
      responseStatus: 429,
      quotaFinished: true,
      details: 'YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY',
    });
    assert.equal(quota.error, 'quota');
    assert.equal(quota.reason, 'quotaFinished');
  });

  it('does not treat HTTP 403 as quota without the quota text', () => {
    const classified = classifyMyMemoryResponse({ httpStatus: 403 });
    assert.notEqual(classified.error, 'quota');
    assert.equal(classified.error, 'rejected');
  });

  it('parses Retry-After seconds', () => {
    assert.equal(parseRetryAfterMs('8'), 8_000);
    assert.equal(parseRetryAfterMs('not-a-delay'), undefined);
  });
});
