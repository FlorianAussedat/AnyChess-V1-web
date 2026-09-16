import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import {
  BoardReplayController,
  type BlindPhase,
  type BlindSequenceMove,
} from '@/lib/blind';
import {
  dictationPaceToGapMs,
  preferencesStore,
} from '@/lib/preferences';
import { replayLine, type ReplayLineHandle } from '@/lib/replay';
import type { LastMove } from '@/contexts/GameContext';

type SyncBoard = () => void;

/**
 * Internal Blind mode visual replay (observation + results).
 * Uses global dictationPace for inter-move delay.
 */
export function useBlindVisualReplay(opts: {
  gameRef: React.MutableRefObject<Chess>;
  syncBoard: SyncBoard;
  setLastMove: (m: LastMove | null) => void;
  setObservationIndex: (n: number) => void;
  setExpectedIndex: (n: number) => void;
  setPhase: (p: BlindPhase) => void;
  setLastFeedback: (s: string | null) => void;
}) {
  const {
    gameRef,
    syncBoard,
    setLastMove,
    setObservationIndex,
    setExpectedIndex,
    setPhase,
    setLastFeedback,
  } = opts;

  const replayRef = useRef(new BoardReplayController());
  const resultReplayRef = useRef<ReplayLineHandle | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);

  const playVisualReplay = useCallback(
    (
      moves: BlindSequenceMove[],
      options: { after: 'recitation' | 'keep-final' },
    ) => {
      replayRef.current.cancel();
      gameRef.current.reset();
      setLastMove(null);
      setObservationIndex(0);
      syncBoard();
      setIsReplaying(true);

      const gapMs = dictationPaceToGapMs(
        preferencesStore.getPreferences().dictationPace,
      );

      replayRef.current.start(moves, gapMs, {
        onMove: (m, index) => {
          try {
            const played = gameRef.current.move({
              from: m.from,
              to: m.to,
              promotion: m.promotion || 'q',
            }) as Move;
            setLastMove({ from: played.from, to: played.to });
            syncBoard();
            setObservationIndex(index + 1);
          } catch {
            /* ignore */
          }
        },
        onComplete: () => {
          setIsReplaying(false);
          if (options.after === 'recitation') {
            gameRef.current.reset();
            setLastMove(null);
            syncBoard();
            setExpectedIndex(0);
            setPhase('recitation');
            setLastFeedback('Récite la séquence à voix haute, coup par coup.');
          }
        },
      });
    },
    [
      gameRef,
      syncBoard,
      setLastMove,
      setObservationIndex,
      setExpectedIndex,
      setPhase,
      setLastFeedback,
    ],
  );

  const playVisualReplayRef = useRef(playVisualReplay);
  useEffect(() => {
    playVisualReplayRef.current = playVisualReplay;
  }, [playVisualReplay]);

  const playResultReplay = useCallback(
    (moves: BlindSequenceMove[]) => {
      resultReplayRef.current?.cancel();
      gameRef.current.reset();
      setLastMove(null);
      setObservationIndex(0);
      syncBoard();
      setIsReplaying(true);

      resultReplayRef.current = replayLine({
        moves: moves.map((m) => ({
          from: m.from,
          to: m.to,
          promotion: m.promotion,
          san: m.san,
        })),
        intervalMs: dictationPaceToGapMs(
          preferencesStore.getPreferences().dictationPace,
        ),
        onMove: (m, index) => {
          try {
            const played = gameRef.current.move({
              from: m.from,
              to: m.to,
              promotion: m.promotion || 'q',
            }) as Move;
            setLastMove({ from: played.from, to: played.to });
            syncBoard();
            setObservationIndex(index + 1);
          } catch {
            /* ignore */
          }
        },
        onComplete: () => {
          setIsReplaying(false);
        },
      });
    },
    [gameRef, syncBoard, setLastMove, setObservationIndex],
  );

  return {
    isReplaying,
    setIsReplaying,
    playVisualReplay,
    playResultReplay,
    playVisualReplayRef,
    replayRef,
    resultReplayRef,
  };
}
