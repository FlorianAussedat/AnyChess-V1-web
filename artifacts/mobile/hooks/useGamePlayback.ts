/**
 * Game Reader playback hook — wraps GamePlaybackScheduler + board derivation.
 * Reuses SpeechService + sanToVerbal + dictationPace gaps.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { BoardPiece, LastMove } from '@/lib/game/types';
import { sanToVerbal } from '@/lib/chessParser';
import {
  DICTATION_PACES,
  type DictationPace,
} from '@/lib/preferences/dictationPace';
import { speechService } from '@/services/SpeechService';
import {
  createPlaybackSnapshot,
  formatPlyLabel,
  GamePlaybackScheduler,
  type ImportedChessGame,
  type GamePlaybackSnapshot,
} from '@/lib/gameLibrary';

export { DICTATION_PACES };

function boardFromFen(fen: string): (BoardPiece | null)[][] {
  return new Chess(fen).board() as (BoardPiece | null)[][];
}

function lastMoveForPly(game: ImportedChessGame, ply: number): LastMove | null {
  if (ply < 1) return null;
  const beforeFen = ply === 1 ? game.initialFen : game.moves[ply - 2]!.fenAfter;
  const san = game.moves[ply - 1]!.san;
  try {
    const c = new Chess(beforeFen);
    const m = c.move(san);
    if (!m) return null;
    return { from: m.from, to: m.to };
  } catch {
    return null;
  }
}

export type UseGamePlaybackOptions = {
  game: ImportedChessGame;
  /** Initial session pace (defaults to medium). */
  initialPace?: DictationPace;
  /** Whether TTS is enabled (respects prefs). */
  voiceEnabled?: boolean;
};

export function useGamePlayback({
  game,
  initialPace = 'medium',
  voiceEnabled = true,
}: UseGamePlaybackOptions) {
  const voiceRef = useRef(voiceEnabled);
  useEffect(() => {
    voiceRef.current = voiceEnabled;
  }, [voiceEnabled]);

  const [ply, setPly] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [pace, setPaceState] = useState<DictationPace>(initialPace);
  const [ended, setEnded] = useState(false);

  const schedulerRef = useRef<GamePlaybackScheduler | null>(null);
  const initialPaceRef = useRef(initialPace);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    initialPaceRef.current = initialPace;
    const currentGame = gameRef.current;
    const scheduler = new GamePlaybackScheduler({
      game: currentGame,
      initialPace: initialPaceRef.current,
      speech: {
        speakSan: async (san: string) => {
          if (!voiceRef.current) return;
          const verbal = sanToVerbal(san);
          if (!verbal.trim()) return;
          await speechService.speakAndWait(verbal);
        },
        cancel: (reason: string) => {
          speechService.cancel(reason);
        },
      },
      onStateChange: (state) => {
        setPly(state.ply);
        setIsPlaying(state.isPlaying);
        setPaceState(state.pace);
        setEnded(state.ended);
      },
    });
    schedulerRef.current = scheduler;
    setPly(0);
    setIsPlaying(false);
    setEnded(false);
    setPaceState(initialPaceRef.current);
    return () => {
      scheduler.dispose();
      if (schedulerRef.current === scheduler) {
        schedulerRef.current = null;
      }
    };
  }, [game.id]);

  const snapshot: GamePlaybackSnapshot = createPlaybackSnapshot(game, ply);
  const board = useMemo(() => boardFromFen(snapshot.fen), [snapshot.fen]);
  const lastMove = useMemo(() => lastMoveForPly(game, ply), [game, ply]);

  const setPace = useCallback((next: DictationPace) => {
    schedulerRef.current?.setPace(next);
  }, []);

  const jumpTo = useCallback((target: number) => {
    schedulerRef.current?.jumpTo(target);
  }, []);
  const goStart = useCallback(() => schedulerRef.current?.goStart(), []);
  const goEnd = useCallback(() => schedulerRef.current?.goEnd(), []);
  const goPrev = useCallback(() => schedulerRef.current?.goPrev(), []);
  const goNext = useCallback(() => schedulerRef.current?.goNext(), []);
  const play = useCallback(() => schedulerRef.current?.play(), []);
  const pause = useCallback(() => schedulerRef.current?.pause(), []);
  const togglePlay = useCallback(() => {
    const s = schedulerRef.current;
    if (!s) return;
    if (s.getState().isPlaying) s.pause();
    else s.play();
  }, []);
  const repeatLast = useCallback(async () => {
    await schedulerRef.current?.repeatLast();
  }, []);
  const stopPlayback = useCallback((reason: string = 'stop') => {
    const s = schedulerRef.current;
    if (!s) {
      speechService.cancel(reason);
      return;
    }
    s.pause();
  }, []);

  const getTrainingContext = useCallback(() => {
    return schedulerRef.current?.getTrainingContext() ?? null;
  }, []);

  const clocks = (() => {
    if (ply < 1) {
      return {
        white: undefined as string | undefined,
        black: undefined as string | undefined,
      };
    }
    let white: string | undefined;
    let black: string | undefined;
    for (let i = 0; i < ply; i += 1) {
      const clk = game.moves[i]?.clock;
      if (!clk) continue;
      if ((i + 1) % 2 === 1) white = clk;
      else black = clk;
    }
    return { white, black };
  })();

  return {
    ply,
    snapshot,
    board,
    lastMove,
    isPlaying,
    ended,
    pace,
    setPace,
    label: formatPlyLabel(game, ply),
    clocks,
    jumpTo,
    goStart,
    goEnd,
    goPrev,
    goNext,
    play,
    pause,
    togglePlay,
    repeatLast,
    stopPlayback,
    getTrainingContext,
  };
}
