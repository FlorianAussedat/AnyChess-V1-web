import { useCallback, useRef } from 'react';
import {
  blindSpeedToDelayMs,
  type BlindSequenceMove,
} from '@/lib/blind';
import { speechService } from '@/services/SpeechService';

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
    (moves: BlindSequenceMove[], flush = true) => {
      clearDictationTimer();
      // Cancel first (bumps generation), then capture token so stale setTimeouts no-op.
      if (flush) speechService.cancel('dictation');
      const myGen = speechService.generation;
      const delay = blindSpeedToDelayMs(speedRef.current);
      let i = 0;
      const step = () => {
        if (speechService.generation !== myGen) return;
        if (i >= moves.length) return;
        // Already cancelled above when flush; avoid a second hardStop that would
        // bump generation and invalidate myGen.
        speechService.speak(moves[i].verbal, { rate: 0.92, flush: false });
        i += 1;
        if (i < moves.length) {
          dictationTimerRef.current = setTimeout(step, delay);
        }
      };
      step();
    },
    [clearDictationTimer, speedRef],
  );

  return { speakSequence, clearDictationTimer };
}
