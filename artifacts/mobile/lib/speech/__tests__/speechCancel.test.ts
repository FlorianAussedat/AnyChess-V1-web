/**
 * Pure helpers for SpeechService cancellation semantics (no expo-speech).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors SpeechService generation-token logic: a cancel bumps the token so
 * stale scheduled steps must no-op.
 */
function createSpeechTokenMachine() {
  let token = 0;
  let queue: string[] = [];
  return {
    get generation() {
      return token;
    },
    enqueue(text: string) {
      queue.push(text);
    },
    cancel() {
      token += 1;
      queue = [];
    },
    /** Simulate a delayed step that only runs if generation matches. */
    runIfCurrent(myToken: number, fn: () => void) {
      if (myToken === token) fn();
    },
    get queue() {
      return [...queue];
    },
  };
}

describe('TTS cancellation token machine', () => {
  it('discards queued speech after cancel', () => {
    const m = createSpeechTokenMachine();
    m.enqueue('e4');
    m.enqueue('e5');
    assert.equal(m.queue.length, 2);
    m.cancel();
    assert.equal(m.queue.length, 0);
  });

  it('ignores stale scheduled steps after cancel', () => {
    const m = createSpeechTokenMachine();
    const startToken = m.generation;
    m.enqueue('coup un');
    let spoken = 0;
    m.cancel(); // user navigates away
    m.runIfCurrent(startToken, () => {
      spoken += 1;
    });
    assert.equal(spoken, 0);
    assert.notEqual(m.generation, startToken);
  });

  it('allows a fresh sequence after cancel', () => {
    const m = createSpeechTokenMachine();
    m.enqueue('old');
    m.cancel();
    const t = m.generation;
    m.enqueue('new');
    let spoken = '';
    m.runIfCurrent(t, () => {
      spoken = m.queue[0] ?? '';
    });
    assert.equal(spoken, 'new');
  });
});
