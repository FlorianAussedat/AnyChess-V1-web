import { useCallback, useEffect, useRef } from 'react';
import { useBoardTouchSelection, useMoveEventFeedback } from './useGameScreenInteraction';
import { useSpeechInput } from '@/services/SpeechRecognitionService';

type Options = {
  canAct: boolean;
  getLegalDestinations: (from: string) => string[];
  onMove: (from: string, to: string, promotion?: string) => void | Promise<void>;
  onSan: (san: string) => void | Promise<void>;
};

/**
 * Shared exercise input: touch selection + optional voice (Classic mode handled by parent).
 */
export function useExerciseBoardTouch(opts: Options) {
  const moveBySquare = useCallback(
    (from: string, to: string) => {
      void opts.onMove(from, to);
      return true;
    },
    [opts.onMove],
  );

  return useBoardTouchSelection({
    canAct: opts.canAct,
    getLegalDestinations: opts.getLegalDestinations,
    movePieceBySquare: moveBySquare,
  });
}

export function useExerciseSpeechInput(opts: {
  enabled: boolean;
  onSan: (san: string) => void | Promise<void>;
}) {
  const applyRef = useRef(opts.onSan);
  useEffect(() => {
    applyRef.current = opts.onSan;
  }, [opts.onSan]);

  const speech = useSpeechInput({
    enabled: opts.enabled,
    isSpeaking: false,
    onTranscript: (text) => {
      void applyRef.current(text);
    },
  });

  const { showRecognized } = useMoveEventFeedback(null);

  return {
    listening: speech.isListening,
    micActive: speech.micActive,
    toggleListening: speech.toggleMic,
    showRecognized,
  };
}
