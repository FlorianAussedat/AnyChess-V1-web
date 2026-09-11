/**
 * Lecteur synchronized voice playback.
 * Reuses SpeechService + global dictationPace (no local speed control).
 *
 * repeatAll: speaks the full active line to its end (variation-aware), audio only.
 */
import { sanToVerbal } from '../chessParser.ts';
import {
  playSynchronizedSequence,
  type SynchronizedSequenceHandle,
} from '../presentation/synchronizedSequence.ts';
import type { DictationPace } from '../preferences/dictationPace.ts';
import type { ReaderGame, ReaderNode } from './types.ts';
import { buildActiveLine } from './gameReaderState.ts';

export type ReaderPlaybackDeps = {
  speakAndWait: (text: string) => Promise<void>;
  cancelSpeech: (reason?: string) => void;
  pace: DictationPace;
  gapMs?: number;
};

export type ReaderPlaybackController = {
  playFrom: (
    game: ReaderGame,
    currentNodeId: string | null,
    onReachNode: (nodeId: string) => void,
  ) => SynchronizedSequenceHandle;
  repeatMovesAudio: (
    game: ReaderGame,
    currentNodeId: string | null,
    count: number,
    reps: number,
  ) => SynchronizedSequenceHandle;
  repeatAllAudio: (
    game: ReaderGame,
    currentNodeId: string | null,
  ) => SynchronizedSequenceHandle;
  cancel: (reason?: string) => void;
};

type MoveWithNode = { san: string; verbal?: string; nodeId?: string };

function lineNodes(game: ReaderGame, currentNodeId: string | null): ReaderNode[] {
  return buildActiveLine(game, currentNodeId)
    .map((id) => game.nodesById[id])
    .filter((n): n is ReaderNode => Boolean(n));
}

export function createReaderPlayback(
  deps: ReaderPlaybackDeps,
): ReaderPlaybackController {
  let handle: SynchronizedSequenceHandle | null = null;
  const speakAndWait = deps.speakAndWait;
  const cancelSpeech = deps.cancelSpeech;

  const cancel = (reason = 'reader-playback') => {
    handle?.cancel();
    handle = null;
    cancelSpeech(reason);
  };

  return {
    playFrom(game, currentNodeId, onReachNode) {
      cancel('reader-play-restart');
      const line = buildActiveLine(game, currentNodeId);
      const start = currentNodeId ? line.indexOf(currentNodeId) + 1 : 0;
      const moves: MoveWithNode[] = line.slice(Math.max(0, start)).map((id) => {
        const node = game.nodesById[id]!;
        return { san: node.san, verbal: sanToVerbal(node.san), nodeId: id };
      });
      handle = playSynchronizedSequence({
        moves,
        speak: true,
        pace: deps.pace,
        gapMs: deps.gapMs,
        speakAndWait,
        onBoardMove: async (move) => {
          const nodeId = (move as MoveWithNode).nodeId;
          if (nodeId) onReachNode(nodeId);
        },
      });
      return handle;
    },
    repeatMovesAudio(game, currentNodeId, count, reps) {
      cancel('reader-repeat-moves');
      const nodes = lineNodes(game, currentNodeId);
      if (!currentNodeId || nodes.length === 0) {
        handle = playSynchronizedSequence({
          moves: [],
          speak: false,
          speakAndWait,
        });
        return handle;
      }
      const idx = nodes.findIndex((n) => n.id === currentNodeId);
      const end = idx >= 0 ? idx + 1 : nodes.length;
      const start = Math.max(0, end - Math.max(1, count));
      const slice = nodes.slice(start, end);
      const sequence = Array.from({ length: Math.max(1, reps) }, () =>
        slice.map((n) => ({ san: n.san, verbal: sanToVerbal(n.san) })),
      ).flat();
      handle = playSynchronizedSequence({
        moves: sequence,
        speak: true,
        pace: deps.pace,
        gapMs: deps.gapMs,
        speakAndWait,
      });
      return handle;
    },
    repeatAllAudio(game, currentNodeId) {
      cancel('reader-repeat-all');
      const nodes = lineNodes(game, currentNodeId);
      handle = playSynchronizedSequence({
        moves: nodes.map((n) => ({
          san: n.san,
          verbal: sanToVerbal(n.san),
        })),
        speak: true,
        pace: deps.pace,
        gapMs: deps.gapMs,
        speakAndWait,
      });
      return handle;
    },
    cancel,
  };
}
