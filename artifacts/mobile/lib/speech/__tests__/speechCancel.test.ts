/**
 * Pure helpers for SpeechService cancellation semantics (no expo-speech).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const speechServiceSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../services/SpeechService.ts'),
  'utf8',
);

const dictationSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../hooks/useBlindDictation.ts'),
  'utf8',
);

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

/**
 * Mirrors SpeechService.stop / cancel / hardStop after the device RangeError:
 * stop → hardStop → onCancel(clearDictationTimer) → cancel → hardStop → …
 * plus a native Speech.stop() callback that also re-enters cancel on the same stack.
 */
function createGatedStopMachine() {
  let inHardStop = false;
  let depth = 0;
  let maxDepth = 0;
  let speechStopCalls = 0;
  const stopPromises: Promise<void>[] = [];
  const cancelListeners: Array<() => void> = [];

  function speechStop(): Promise<void> {
    speechStopCalls += 1;
    // Native Android TTS: speakingStopped can fire before stop() returns.
    cancel();
    return Promise.resolve();
  }

  function hardStop(_opts: { notify: boolean }): void {
    if (inHardStop) return;
    inHardStop = true;
    depth += 1;
    maxDepth = Math.max(maxDepth, depth);
    try {
      stopPromises.push(Promise.resolve(speechStop()).catch(() => {}));
      if (_opts.notify) {
        for (const listener of cancelListeners) listener();
      }
    } finally {
      depth -= 1;
      inHardStop = false;
    }
  }

  function stop(): void {
    hardStop({ notify: true });
  }

  function cancel(_reason?: string): void {
    void _reason;
    hardStop({ notify: true });
  }

  // Production: BlindSequenceContext onCancel → clearDictationTimer → cancel.
  cancelListeners.push(() => {
    cancel('dictation');
  });

  return {
    stop,
    cancel,
    hardStop,
    get maxDepth() {
      return maxDepth;
    },
    get speechStopCalls() {
      return speechStopCalls;
    },
    get pendingStops() {
      return stopPromises;
    },
  };
}

describe('TTS stop/cancel/hardStop re-entrancy gate', () => {
  it('SpeechService latches hardStop before Speech.stop and releases in finally', () => {
    assert.match(speechServiceSrc, /private inHardStop = false/);
    assert.match(speechServiceSrc, /if \(this\.inHardStop\) return/);
    const latchIdx = speechServiceSrc.indexOf('this.inHardStop = true');
    const stopIdx = speechServiceSrc.indexOf('Promise.resolve(Speech.stop())');
    const finallyIdx = speechServiceSrc.indexOf('this.inHardStop = false');
    assert.ok(latchIdx > 0 && stopIdx > latchIdx, 'latch before Speech.stop()');
    assert.ok(finallyIdx > stopIdx, 'release after Speech.stop()');
    assert.match(speechServiceSrc, /Promise\.resolve\(Speech\.stop\(\)\)\.catch/);
  });

  it('documents the production cycle: onCancel clearDictationTimer calls cancel', () => {
    assert.match(dictationSrc, /speechService\.cancel\('dictation'\)/);
    assert.match(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), '../../../contexts/BlindSequenceContext.tsx'),
        'utf8',
      ),
      /speechService\.onCancel\(\(\) => clearDictationTimer\(\)\)/,
    );
  });

  it('successive stop/cancel/hardStop neither recurse nor reject', async () => {
    const m = createGatedStopMachine();
    m.stop();
    m.cancel('user');
    m.hardStop({ notify: true });
    m.stop();
    m.cancel();
    assert.equal(m.maxDepth, 1);
    assert.equal(m.speechStopCalls, 5);
    await Promise.all(m.pendingStops);
  });
});
