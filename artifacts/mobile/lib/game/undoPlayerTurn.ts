/**
 * Undo the player's last turn.
 *
 * Rules (STM-safe):
 * - If the last ply is still the player's (reply not on the board yet), undo
 *   only that ply — never pop an earlier opponent move.
 * - If the last ply is the opponent's reply, undo opponent then player.
 *
 * Mutates `game`. Callers must realign waitingForUser vs side-to-move after.
 */
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
      /** True when it is now the opponent's turn to move (e.g. player is Black). */
      needsOpponentKickoff: boolean;
    }
  | {
      kind: 'undone';
      lastMove: LastMove | null;
      status: string;
      speak: string;
      plyAfter: number;
      needsOpponentKickoff: boolean;
    };

function lastMoveHighlight(game: Chess): LastMove | null {
  const remaining = game.history({ verbose: true }) as Move[];
  if (remaining.length === 0) return null;
  const last = remaining[remaining.length - 1]!;
  return { from: last.from, to: last.to };
}

export function undoPlayerTurn(
  game: Chess,
  playerColor: PlayerColor,
): UndoPlayerTurnResult {
  const allMoves = game.history({ verbose: true }) as Move[];
  if (allMoves.length === 0) return { kind: 'noop' };

  const last = allMoves[allMoves.length - 1]!;

  // Reply not yet applied — undo only the player's ply.
  if (last.color === playerColor) {
    game.undo();
    const remaining = game.history({ verbose: true }) as Move[];
    const needsOpponentKickoff =
      !game.isGameOver() && game.turn() !== playerColor;
    if (remaining.length === 0) {
      return {
        kind: 'undone-to-start',
        status: tMsg('game.undoToStartStatus'),
        speak: tMsg('game.undoToStartSpeak'),
        needsOpponentKickoff,
      };
    }
    const engineColor: PlayerColor = playerColor === 'w' ? 'b' : 'w';
    const lastEngine =
      remaining
        .slice()
        .reverse()
        .find((m) => m.color === engineColor) ?? null;
    if (lastEngine) {
      const announcement = verbalMove(lastEngine);
      return {
        kind: 'undone',
        lastMove: lastMoveHighlight(game),
        status: announcement,
        speak: tMsg('game.undoOpponentSpeak', { move: announcement }),
        plyAfter: remaining.length,
        needsOpponentKickoff,
      };
    }
    return {
      kind: 'undone',
      lastMove: lastMoveHighlight(game),
      status: tMsg('game.undoToStartStatus'),
      speak: tMsg('game.undoToStartSpeak'),
      plyAfter: remaining.length,
      needsOpponentKickoff,
    };
  }

  // Last ply is opponent — undo reply, then player ply if present.
  game.undo();
  const mid = game.history({ verbose: true }) as Move[];
  if (mid.length > 0 && mid[mid.length - 1]!.color === playerColor) {
    game.undo();
  } else {
    // No player ply underneath — nothing belonging to the player to undo.
    // Restore opponent ply (we should not have undone it alone).
    // Actually: if last was opponent and no player below, it's opponent's first
    // move (player is Black at start). Undoing opponent-only is correct for
    // "kickoff" situations when player undoes... but player usually can't undo
    // opponent's opening move as "their turn". Treat as undo of that ply only
    // when player is waiting after opponent kickoff — rare. Keep undone.
  }

  const remaining = game.history({ verbose: true }) as Move[];
  const needsOpponentKickoff =
    !game.isGameOver() && game.turn() !== playerColor;

  if (remaining.length === 0) {
    return {
      kind: 'undone-to-start',
      status: tMsg('game.undoToStartStatus'),
      speak: tMsg('game.undoToStartSpeak'),
      needsOpponentKickoff,
    };
  }

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
      lastMove: lastMoveHighlight(game),
      status: announcement,
      speak: tMsg('game.undoOpponentSpeak', { move: announcement }),
      plyAfter: remaining.length,
      needsOpponentKickoff,
    };
  }

  return {
    kind: 'undone',
    lastMove: lastMoveHighlight(game),
    status: tMsg('game.undoToStartStatus'),
    speak: tMsg('game.undoToStartSpeak'),
    plyAfter: remaining.length,
    needsOpponentKickoff,
  };
}
