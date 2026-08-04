/**
 * Pure mic / recognition lifecycle flags used by useSpeechInput.
 * Extracted for unit tests without React or expo-speech-recognition.
 */

export interface MicLifecycleState {
  /** Component still mounted / allowed to drive recognition. */
  alive: boolean;
  /** User wants continuous listening while the screen is active. */
  micActive: boolean;
  /** TTS currently speaking — recognition should stay paused. */
  isSpeaking: boolean;
  /** Recognition session currently running. */
  isListening: boolean;
  /** Hook-level enable flag. */
  enabled: boolean;
}

export function createMicLifecycleState(
  partial: Partial<MicLifecycleState> = {},
): MicLifecycleState {
  return {
    alive: true,
    micActive: false,
    isSpeaking: false,
    isListening: false,
    enabled: true,
    ...partial,
  };
}

/** Whether a delayed restart should call startListening. */
export function shouldRestartRecognition(state: MicLifecycleState): boolean {
  return (
    state.alive &&
    state.enabled &&
    state.micActive &&
    !state.isListening &&
    !state.isSpeaking
  );
}

/**
 * Apply unmount / leave-screen cleanup: mark dead, clear mic intent,
 * and report that recognition must stop.
 */
export function deactivateOnLeave(state: MicLifecycleState): {
  next: MicLifecycleState;
  shouldStopRecognition: boolean;
} {
  const wasActive = state.micActive || state.isListening;
  return {
    next: {
      ...state,
      alive: false,
      micActive: false,
      isListening: false,
    },
    shouldStopRecognition: wasActive || state.alive,
  };
}
