import { useCallback, useEffect, useRef, useState } from 'react';
import type { MoveEvent } from '@/lib/game/types';
import { sfxService } from '@/services/SfxService';
import { triggerHaptic } from '@/lib/feedback/haptics';

/** Haptics + SFX + brief "recognized" mic flash on moveEvent. */
export function useMoveEventFeedback(moveEvent: MoveEvent | null) {
  const [showRecognized, setShowRecognized] = useState(false);
  const recognizedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!moveEvent) return;
    if (moveEvent.kind === 'success') {
      void triggerHaptic('success');
      void sfxService.playSuccess();
      setShowRecognized(true);
      if (recognizedTimerRef.current) clearTimeout(recognizedTimerRef.current);
      recognizedTimerRef.current = setTimeout(() => setShowRecognized(false), 1500);
    } else {
      void triggerHaptic('incorrect');
      void sfxService.playError();
    }
  }, [moveEvent?.id]);

  return { showRecognized };
}

/** Touch piece selection + legal destination highlights. */
export function useBoardTouchSelection(opts: {
  canAct: boolean;
  getLegalDestinations: (square: string) => string[];
  movePieceBySquare: (from: string, to: string) => boolean;
}) {
  const { canAct, getLegalDestinations, movePieceBySquare } = opts;
  const [touchSelected, setTouchSelected] = useState<string | null>(null);
  const [legalDests, setLegalDests] = useState<string[]>([]);

  useEffect(() => {
    if (!canAct) {
      setTouchSelected(null);
      setLegalDests([]);
    }
  }, [canAct]);

  const onSquarePress = useCallback(
    (square: string) => {
      if (!canAct) return;
      if (touchSelected === null) {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        }
      } else if (square === touchSelected) {
        setTouchSelected(null);
        setLegalDests([]);
      } else if (legalDests.includes(square)) {
        movePieceBySquare(touchSelected, square);
        setTouchSelected(null);
        setLegalDests([]);
      } else {
        const dests = getLegalDestinations(square);
        if (dests.length > 0) {
          setTouchSelected(square);
          setLegalDests(dests);
        } else {
          setTouchSelected(null);
          setLegalDests([]);
        }
      }
    },
    [canAct, touchSelected, legalDests, getLegalDestinations, movePieceBySquare],
  );

  return { touchSelected, legalDests, onSquarePress };
}
