/**
 * Focus management for rapid written answers (timed modes, quizzes).
 *
 * After submit: clear the field and restore focus when the platform allows it.
 * Does not force the mobile keyboard open when the input is disabled or when
 * the caller opts out (e.g. microphone-only moments).
 *
 * Platform-agnostic intent — TextInput focus APIs are the adapter surface.
 */
import { useCallback, useRef } from 'react';
import type { TextInput } from 'react-native';

export type PersistentAnswerFocusOptions = {
  /** When false, skip autofocus after clear (e.g. challenge not ready). */
  enabled?: boolean;
};

export function usePersistentAnswerFocus(
  options: PersistentAnswerFocusOptions = {},
) {
  const { enabled = true } = options;
  const inputRef = useRef<TextInput>(null);

  const focus = useCallback(() => {
    if (!enabled) return;
    // Defer one frame so state updates (clear / next challenge) settle first.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [enabled]);

  const blur = useCallback(() => {
    inputRef.current?.blur();
  }, []);

  /**
   * Call after a successful submit handler: clears via the provided setter
   * then restores focus when enabled.
   */
  const afterSubmit = useCallback(
    (clear: () => void) => {
      clear();
      if (enabled) focus();
    },
    [enabled, focus],
  );

  return { inputRef, focus, blur, afterSubmit };
}
