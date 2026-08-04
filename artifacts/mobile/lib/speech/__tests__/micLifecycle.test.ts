import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMicLifecycleState,
  deactivateOnLeave,
  shouldRestartRecognition,
} from '../micLifecycle.ts';

describe('mic recognition lifecycle', () => {
  it('restarts only while alive, mic active, idle, and not speaking', () => {
    assert.equal(
      shouldRestartRecognition(
        createMicLifecycleState({
          alive: true,
          micActive: true,
          isListening: false,
          isSpeaking: false,
        }),
      ),
      true,
    );
    assert.equal(
      shouldRestartRecognition(
        createMicLifecycleState({
          alive: true,
          micActive: true,
          isListening: true,
        }),
      ),
      false,
    );
    assert.equal(
      shouldRestartRecognition(
        createMicLifecycleState({
          alive: true,
          micActive: true,
          isSpeaking: true,
        }),
      ),
      false,
    );
  });

  it('does not restart after leave / unmount', () => {
    const active = createMicLifecycleState({
      alive: true,
      micActive: true,
      isListening: true,
    });
    const { next, shouldStopRecognition } = deactivateOnLeave(active);
    assert.equal(shouldStopRecognition, true);
    assert.equal(next.alive, false);
    assert.equal(next.micActive, false);
    assert.equal(shouldRestartRecognition(next), false);
  });

  it('still requests stop when leaving with mic already idle', () => {
    const idle = createMicLifecycleState({ alive: true, micActive: false });
    const { shouldStopRecognition } = deactivateOnLeave(idle);
    assert.equal(shouldStopRecognition, true);
  });
});
