import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import {
  BoardReplayController,
  blindSpeedToDelayMs,
  type BlindPhase,
  type BlindSequenceMove,
} from '@/lib/blind';
import { replayLine, type ReplayLineHandle } from '@/lib/replay';
import type { LastMove } from '@/contexts/GameContext';

type SyncBoard = () => void;

/**
 * Internal Blind mode visual replay (observation + results).
 * Composed inside BlindSequenceProvider — not a public API.
 */
export function useBlindVisualReplay(opts: {
  gameRef: React.MutableRefObject<Chess>;
  speedRef: React.MutableRefObject<number>;
  syncBoard: SyncBoard;
  setLastMove: (m: LastMove | null) => void;
  setObservationIndex: (n: number) => void;
  setExpectedIndex: (n: number) => void;
  setPhase: (p: BlindPhase) => void;
  setLastFeedback: (s: string | null) => void;
}) {
  const {
    gameRef,
    speedRef,
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

      replayRef.current.start(moves, blindSpeedToDelayMs(speedRef.current), {
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
          // keep-final: leave the board on the last position (observation or results)
        },
      });
    },
    [
      gameRef,
      speedRef,
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
        intervalMs: 1000,
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
