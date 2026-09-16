/**
 * Dictation pace mapping and synchronized sequence contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DICTATION_PACE,
  DICTATION_PACE_GAP_MS,
  dictationPaceToGapMs,
  isDictationPace,
} from '../../preferences/dictationPace.ts';
import { playSynchronizedSequence } from '../synchronizedSequence.ts';

describe('dictationPace mapping', () => {
  it('maps the five levels to 5/4/3/2/1 seconds', () => {
    assert.equal(dictationPaceToGapMs('slow'), 5000);
    assert.equal(dictationPaceToGapMs('quiteSlow'), 4000);
    assert.equal(dictationPaceToGapMs('medium'), 3000);
    assert.equal(dictationPaceToGapMs('quiteFast'), 2000);
    assert.equal(dictationPaceToGapMs('fast'), 1000);
    assert.equal(DICTATION_PACE_GAP_MS.medium, 3000);
    assert.equal(DEFAULT_DICTATION_PACE, 'medium');
    assert.ok(isDictationPace('medium'));
    assert.equal(isDictationPace('turbo'), false);
  });
});

describe('playSynchronizedSequence', () => {
  it('orders board → speech → pause → next board', async () => {
    const events: string[] = [];
    const handle = playSynchronizedSequence({
      moves: [
        { san: 'e4', verbal: 'pion e4' },
        { san: 'e5', verbal: 'pion e5' },
      ],
      speak: true,
      gapMs: 15,
      speakAndWait: async (text) => {
        events.push(`speak:${text}`);
      },
      onBoardMove: (m) => {
        events.push(`board:${m.san}`);
      },
      delay: async (ms) => {
        events.push(`pause:${ms}`);
      },
    });
    await handle.done;
    assert.deepEqual(events, [
      'board:e4',
      'speak:pion e4',
      'pause:15',
      'board:e5',
      'speak:pion e5',
    ]);
  });

  it('skips TTS when speak is false but still paces', async () => {
    const events: string[] = [];
    const handle = playSynchronizedSequence({
      moves: [
        { san: 'e4', verbal: 'pion e4' },
        { san: 'e5', verbal: 'pion e5' },
      ],
      speak: false,
      gapMs: 10,
      speakAndWait: async () => {
        events.push('speak');
      },
      onBoardMove: (m) => {
        events.push(`board:${m.san}`);
      },
      delay: async (ms) => {
        events.push(`pause:${ms}`);
      },
    });
    await handle.done;
    assert.deepEqual(events, ['board:e4', 'pause:10', 'board:e5']);
  });

  it('cancel prevents the next move', async () => {
    const events: string[] = [];
    let releaseSpeak: (() => void) | null = null;
    const handle = playSynchronizedSequence({
      moves: [
        { san: 'e4', verbal: 'a' },
        { san: 'e5', verbal: 'b' },
      ],
      speak: true,
      gapMs: 50,
      speakAndWait: () =>
        new Promise<void>((resolve) => {
          events.push('speak');
          releaseSpeak = resolve;
        }),
      onBoardMove: (m) => {
        events.push(`board:${m.san}`);
      },
      delay: async () => {
        events.push('pause');
      },
    });

    await new Promise((r) => setImmediate(r));
    assert.deepEqual(events, ['board:e4', 'speak']);
    handle.cancel();
    releaseSpeak?.();
    await handle.done;
    assert.ok(!events.includes('board:e5'));
    assert.ok(!events.includes('pause'));
  });
});
