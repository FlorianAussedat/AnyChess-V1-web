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
  /**
   * App is in the foreground. Background stops the microphone and must not
   * restart it until the user is back.
   */
  foreground?: boolean;
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
    foreground: true,
    ...partial,
  };
}

/**
 * A transcript belongs to the session and position that produced it.
 * A repeated final result for the same text is ignored.
 */
export function shouldApplyRecognitionResult(input: {
  alive: boolean;
  eventSession: number;
  activeSession: number;
  eventFen: string | null;
  activeFen: string | null;
  fingerprint: string;
  lastFingerprint: string | null;
}): boolean {
  if (!input.alive) return false;
  if (input.eventSession !== input.activeSession) return false;
  if ((input.eventFen ?? null) !== (input.activeFen ?? null)) return false;
  if (input.fingerprint.length > 0 && input.fingerprint === input.lastFingerprint) return false;
  return true;
}

/** Whether a delayed restart should call startListening. */
export function shouldRestartRecognition(state: MicLifecycleState): boolean {
  return (
    state.alive &&
    state.enabled &&
    state.foreground !== false &&
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
