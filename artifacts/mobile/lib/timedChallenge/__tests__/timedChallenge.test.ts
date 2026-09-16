import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COUNTDOWN_LABELS,
  COUNTDOWN_STEP_MS,
  SESSION_SECONDS,
  TimedChallengeTimer,
  isRecordBeat,
} from '../index.ts';

describe('timed challenge shared primitives', () => {
  it('exposes countdown labels and 60-second session constant', () => {
    assert.deepEqual([...COUNTDOWN_LABELS], ['3', '2', '1', 'Chess!']);
    assert.equal(COUNTDOWN_STEP_MS, 1000);
    assert.equal(SESSION_SECONDS, 60);
  });

  it('compares records strictly (ties do not beat)', () => {
    assert.equal(isRecordBeat(1, 0), true);
    assert.equal(isRecordBeat(5, 5), false);
    assert.equal(isRecordBeat(4, 5), false);
  });

  it('fires session end and clears on dispose / restart', async () => {
    const timer = new TimedChallengeTimer();
    let ends = 0;
    timer.startSession(0.05, () => {
      ends += 1;
    });
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(ends, 1);

    timer.startSession(0.05, () => {
      ends += 1;
    });
    timer.dispose();
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(ends, 1);
  });
});
