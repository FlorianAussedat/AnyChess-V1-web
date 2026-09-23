/**
 * Opponent kickoff must replace, not stack, pending timeouts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scheduleExclusiveTimeout } from '../scheduleExclusiveTimeout.ts';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('scheduleExclusiveTimeout', () => {
  it('two successive schedules fire only one callback', async () => {
    let kicks = 0;
    let handle: ReturnType<typeof setTimeout> | null = null;
    handle = scheduleExclusiveTimeout(handle, 25, () => {
      kicks += 1;
    });
    handle = scheduleExclusiveTimeout(handle, 25, () => {
      kicks += 1;
    });
    await wait(80);
    assert.equal(kicks, 1);
  });
});
