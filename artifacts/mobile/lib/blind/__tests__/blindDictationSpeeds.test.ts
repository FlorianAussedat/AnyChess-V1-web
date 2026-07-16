import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DICTATION_SPEEDS, OBSERVATION_DELAY_MS } from '../types.ts';

describe('blind dictation and observation speeds', () => {
  it('centralizes dictation speeds for listen-reconstruct', () => {
    assert.deepEqual(DICTATION_SPEEDS, { slow: 5000, medium: 3000, fast: 1000 });
  });

  it('keeps observation delays separate from dictation pace keys', () => {
    assert.deepEqual(OBSERVATION_DELAY_MS, { slow: 5000, normal: 3000, fast: 1000 });
    assert.equal(DICTATION_SPEEDS.medium, 3000);
    assert.equal(OBSERVATION_DELAY_MS.normal, 3000);
  });
});
