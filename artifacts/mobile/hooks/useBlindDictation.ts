import { useCallback, useRef } from 'react';
import type { BlindSequenceMove } from '@/lib/blind';
import {
  dictationPaceToGapMs,
  preferencesStore,
} from '@/lib/preferences';
import { speechService } from '@/services/SpeechService';

type ProgressHandlers = {
  /** Called with 1-based spoken count after each utterance starts. */
  onSpokenCount?: (spokenCount: number, total: number) => void;
  /** Called once when the last move has been spoken (or sequence cancelled). */
  onComplete?: () => void;
};

/**
 * Blind listen-mode dictation: speak → wait real TTS end → global pace gap → next.
 */
export function useBlindDictation() {
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  const clearDictationTimer = useCallback(() => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    speechService.cancel('dictation');
  }, []);

  const speakSequence = useCallback(
    (moves: BlindSequenceMove[], flush = true, handlers: ProgressHandlers = {}) => {
      cancelledRef.current = false;
      if (flush) speechService.cancel('dictation');
      const runId = ++runIdRef.current;

      void (async () => {
        const pace = preferencesStore.getPreferences().dictationPace;
        const gapMs = dictationPaceToGapMs(pace);

        for (let i = 0; i < moves.length; i++) {
          if (cancelledRef.current || runId !== runIdRef.current) return;
          try {
            await speechService.speakAndWait(moves[i].verbal, { flush: false });
          } catch {
            return;
          }
          handlers.onSpokenCount?.(i + 1, moves.length);
          if (i < moves.length - 1) {
            await new Promise<void>((resolve) => {
              const t = setTimeout(resolve, gapMs);
              const check = setInterval(() => {
                if (cancelledRef.current || runId !== runIdRef.current) {
                  clearTimeout(t);
                  clearInterval(check);
                  resolve();
                }
              }, 40);
              setTimeout(() => clearInterval(check), gapMs + 20);
            });
          }
        }
        if (!cancelledRef.current && runId === runIdRef.current) {
          handlers.onComplete?.();
        }
      })();
    },
    [],
  );

  return { speakSequence, clearDictationTimer };
}
