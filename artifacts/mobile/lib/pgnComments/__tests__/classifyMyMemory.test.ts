import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  classifyMyMemoryResponse,
  extractOfficialMyMemoryQuotaMessage,
  isExhaustedQuotaSignal,
  parseMyMemoryNextAvailableLabel,
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

  it('extracts the official quota sentence and optional NEXT AVAILABLE delay, never PGN', () => {
    const mixed =
      'After 1. e4 {White occupies the centre.} MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN  13 HOURS 31 MINUTES 45 SECONDS VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE user@host.example';
    const official = extractOfficialMyMemoryQuotaMessage(mixed);
    assert.match(official ?? '', /YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY/i);
    assert.match(official ?? '', /NEXT AVAILABLE IN 13 HOURS 31 MINUTES 45 SECONDS/i);
    assert.doesNotMatch(official ?? '', /e4|occupies|user@host/);
    assert.equal(parseMyMemoryNextAvailableLabel(mixed), '13 h 31 min 45 s');
    assert.equal(extractOfficialMyMemoryQuotaMessage('TOO MANY REQUESTS'), null);
    assert.equal(parseMyMemoryNextAvailableLabel('YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'), null);
  });

  it('matches the 195-char official warning that concatenates to detailsLength 391', () => {
    const official =
      'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY. NEXT AVAILABLE IN 13 HOURS 31 MINUTES 45 SECONDS. VISIT HTTPS://MYMEMORY.TRANSLATED.NET/DOC/USAGELIMITS.PHP TO TRANSLATE MORE';
    assert.equal(official.length, 195);
    assert.equal(`${official} ${official}`.length, 391);
    const extracted = extractOfficialMyMemoryQuotaMessage(`${official} ${official}`);
    assert.equal(extracted, official);
    assert.equal(parseMyMemoryNextAvailableLabel(`${official} ${official}`), '13 h 31 min 45 s');
  });
});
