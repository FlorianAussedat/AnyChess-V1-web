import { useCallback, useRef } from 'react';
import {
  blindSpeedToDelayMs,
  type BlindSequenceMove,
} from '@/lib/blind';
import { speechService } from '@/services/SpeechService';

type ProgressHandlers = {
  /** Called with 1-based spoken count after each utterance starts. */
  onSpokenCount?: (spokenCount: number, total: number) => void;
  /** Called once when the last move has been queued / spoken. */
  onComplete?: () => void;
};

/**
 * Internal Blind mode dictation: timed TTS of a move sequence.
 * Composed inside BlindSequenceProvider — not a public API.
 */
export function useBlindDictation(speedRef: React.MutableRefObject<number>) {
  const dictationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDictationTimer = useCallback(() => {
    if (dictationTimerRef.current != null) {
      clearTimeout(dictationTimerRef.current);
      dictationTimerRef.current = null;
    }
  }, []);

  const speakSequence = useCallback(
    (moves: BlindSequenceMove[], flush = true, handlers: ProgressHandlers = {}) => {
      clearDictationTimer();
      // Cancel first (bumps generation), then capture token so stale setTimeouts no-op.
      if (flush) speechService.cancel('dictation');
      const myGen = speechService.generation;
      const delay = blindSpeedToDelayMs(speedRef.current);
      let i = 0;
      const step = () => {
        if (speechService.generation !== myGen) return;
        if (i >= moves.length) {
          handlers.onComplete?.();
          return;
        }
        // Already cancelled above when flush; avoid a second hardStop that would
        // bump generation and invalidate myGen.
        speechService.speak(moves[i].verbal, { flush: false });
        i += 1;
        handlers.onSpokenCount?.(i, moves.length);
        if (i < moves.length) {
          dictationTimerRef.current = setTimeout(step, delay);
        } else {
          // Last move spoken — wait for TTS speaking flag to drop, or mark complete after a beat.
          // Completion of the sequence scheduling is enough for "À ton tour" once isSpeaking falls.
          handlers.onComplete?.();
        }
      };
      step();
    },
    [clearDictationTimer, speedRef],
  );

  return { speakSequence, clearDictationTimer };
}
