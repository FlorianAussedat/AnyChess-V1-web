import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifySignupResponse } from '../authErrors.ts';

describe('signup responses', () => {
  it('does not treat a hidden existing account as a sent email', () => {
    const hidden = classifySignupResponse(200, {
      id: 'user-1',
      email: 'ada@example.com',
      identities: [],
      confirmation_sent_at: '2026-10-01T00:00:00.000Z',
    });
    assert.equal(hidden.kind, 'ambiguous');
  });

  it('recognises a new address that actually asked for confirmation', () => {
    const created = classifySignupResponse(200, {
      id: 'user-2',
      email: 'new@example.com',
      identities: [{ id: 'user-2' }],
      confirmation_sent_at: '2026-10-01T00:00:00.000Z',
    });
    assert.equal(created.kind, 'confirmation');
  });

  it('recognises an unconfirmed account when identities are present', () => {
    const pending = classifySignupResponse(200, {
      id: 'user-3',
      identities: [{ id: 'user-3' }],
    });
    assert.equal(pending.kind, 'confirmation');
  });

  it('uses an explicit taken error and a rate-limit delay', () => {
    assert.equal(
      classifySignupResponse(422, { error_code: 'user_already_exists', msg: 'already registered' }).kind,
      'taken',
    );
    const limited = classifySignupResponse(429, { msg: 'For security purposes, you can only request this after 47 seconds.' });
    assert.equal(limited.kind, 'error');
    if (limited.kind === 'error') {
      assert.equal(limited.error, 'rate_limited');
      assert.equal(limited.retryAfterSeconds, 47);
    }
  });

  it('treats a dropped request as offline', () => {
    const dropped = classifySignupResponse(0, null);
    assert.equal(dropped.kind, 'error');
    if (dropped.kind === 'error') assert.equal(dropped.error, 'offline');
  });
});
