/**
 * Shared move feedback hook — Correct (~3s), incorrect, invalid (clear field).
 * Reuses sfxService + shared haptics; does not own TTS.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sfxService } from '@/services/SfxService';
import { triggerHaptic } from '@/lib/feedback/haptics';
import {
  CORRECT_FEEDBACK_MS,
  initialMoveFeedbackState,
  reduceMoveFeedback,
  type MoveFeedbackState,
} from '@/lib/feedback/moveFeedback';

export type UseMoveFeedbackOptions = {
  /** How long "Correct" stays visible unless cleared early. */
  correctMs?: number;
  /** Play SFX (independent of TTS mute). Default true. */
  playSounds?: boolean;
};

export function useMoveFeedback(options: UseMoveFeedbackOptions = {}) {
  const correctMs = options.correctMs ?? CORRECT_FEEDBACK_MS;
  const playSounds = options.playSounds ?? true;

  const [state, setState] = useState<MoveFeedbackState>(initialMoveFeedbackState);
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimer(), [clearTimer]);

  const clear = useCallback(() => {
    clearTimer();
    setState((prev) => reduceMoveFeedback(prev, { type: 'clear' }));
  }, [clearTimer]);

  /** Call when the user starts another attempt (hides Correct early). */
  const onNextAttempt = useCallback(() => {
    clearTimer();
    setState((prev) => reduceMoveFeedback(prev, { type: 'nextAttempt' }));
  }, [clearTimer]);

  const signalCorrect = useCallback(
    (message?: string) => {
      clearTimer();
      setState((prev) => reduceMoveFeedback(prev, { type: 'correct', message }));
      void triggerHaptic('success');
      if (playSounds) void sfxService.playSuccess();
      clearTimerRef.current = setTimeout(() => {
        setState((prev) => reduceMoveFeedback(prev, { type: 'clear' }));
        clearTimerRef.current = null;
      }, correctMs);
    },
    [clearTimer, correctMs, playSounds],
  );

  const signalIncorrect = useCallback(
    (message?: string) => {
      clearTimer();
      setState((prev) => reduceMoveFeedback(prev, { type: 'incorrect', message }));
      void triggerHaptic('incorrect');
      if (playSounds) void sfxService.playError();
    },
    [clearTimer, playSounds],
  );

  /**
   * Invalid / unparsable input — strong buzz; caller should clear the field.
   * Returns true so callers can `if (signalInvalid()) setText('')`.
   */
  const signalInvalid = useCallback(
    (message?: string) => {
      clearTimer();
      setState((prev) => reduceMoveFeedback(prev, { type: 'invalid', message }));
      void triggerHaptic('invalid');
      if (playSounds) void sfxService.playError();
      return true;
    },
    [clearTimer, playSounds],
  );

  return {
    state,
    isCorrect: state.kind === 'correct',
    isIncorrect: state.kind === 'incorrect',
    isInvalid: state.kind === 'invalid',
    signalCorrect,
    signalIncorrect,
    signalInvalid,
    clear,
    onNextAttempt,
  };
}
