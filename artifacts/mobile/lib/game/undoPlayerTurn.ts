import type { Chess, Move } from 'chess.js';
import { verbalMove } from '../chessParser.ts';
import { tMsg } from '../i18n/tMsg.ts';
import type { LastMove, PlayerColor } from './types.ts';

export type UndoPlayerTurnResult =
  | { kind: 'noop' }
  | {
      kind: 'undone-to-start';
      status: string;
      speak: string;
    }
  | {
      kind: 'undone';
      lastMove: LastMove | null;
      status: string;
      speak: string;
      plyAfter: number;
    };

/**
 * Undo the player's last turn (player + opponent reply when present).
 * Mutates `game`. Callers handle mode-specific book sync after ply changes.
 */
export function undoPlayerTurn(
  game: Chess,
  playerColor: PlayerColor,
): UndoPlayerTurnResult {
  const allMoves = game.history({ verbose: true }) as Move[];

  if (allMoves.length < 2) {
    if (allMoves.length === 1 && allMoves[0].color === playerColor) {
      game.undo();
      return {
        kind: 'undone-to-start',
        status: tMsg('game.undoToStartStatus'),
        speak: tMsg('game.undoToStartSpeak'),
      };
    }
    return { kind: 'noop' };
  }

  game.undo();
  game.undo();

  const remaining = game.history({ verbose: true }) as Move[];
  const lastMove: LastMove | null =
    remaining.length > 0
      ? { from: remaining[remaining.length - 1].from, to: remaining[remaining.length - 1].to }
      : null;

  const engineColor: PlayerColor = playerColor === 'w' ? 'b' : 'w';
  const lastEngineMove =
    remaining
      .slice()
      .reverse()
      .find((m) => m.color === engineColor) ?? null;

  if (lastEngineMove) {
    const announcement = verbalMove(lastEngineMove);
    return {
      kind: 'undone',
      lastMove,
      status: announcement,
      speak: tMsg('game.undoOpponentSpeak', { move: announcement }),
      plyAfter: remaining.length,
    };
  }

  return {
    kind: 'undone',
    lastMove,
    status: tMsg('game.undoToStartStatus'),
    speak: tMsg('game.undoToStartSpeak'),
    plyAfter: remaining.length,
  };
}
