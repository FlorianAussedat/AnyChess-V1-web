/**
 * Automated play toward the exercise objective.
 *
 * A fixed 20-move cap can stop a correct two-bishops mate (catalog DTM 33).
 * The cap follows the catalog distance, with a floor of 36 user moves for
 * that theme. Draw exercises pick a legal user move that completes the
 * recognised mechanism when one exists, instead of engine-best for both
 * sides. Hitting the cap is an interruption, not a scored failure.
 */
import { Chess } from 'chess.js';
import type { DefenseAnalyzer } from '../../defendDraw/defenseTypes.ts';
import { assessDefense } from '../domain/defenseFinish.ts';
import { pickPawnWinUserSan } from '../domain/pawnWinProgress.ts';
import { gradeFamilyFor } from '../domain/gradeFamily.ts';
import type { TheoreticalEndgamePosition } from '../domain/types.ts';

export type PlayFinishCause =
  | 'checkmate'
  | 'draw'
  | 'mechanism'
  | 'cap'
  | 'engine-no-move'
  | 'engine-illegal-move';

export type PlayOutcome = 'success' | 'theoretical-loss' | 'interrupted';

export type PlayTowardResult = {
  outcome: PlayOutcome;
  cause: PlayFinishCause;
  sans: string[];
  userMoves: number;
  endFen: string;
  cap: number;
};

export function playCapFor(position: TheoreticalEndgamePosition): number {
  if (position.themeId === 'two-bishops-mate') {
    const dtm = position.proof.dtm ?? 33;
    return Math.max(36, Math.ceil(dtm / 2) + 12);
  }
  if (position.objective === 'DRAW') {
    return 16;
  }
  const dtm = position.proof.dtm;
  if (typeof dtm === 'number' && dtm > 0) {
    return Math.max(16, Math.min(40, Math.ceil(dtm / 2) + 12));
  }
  return 24;
}

/**
 * On a draw exercise, prefer a user move that completes the measured idea.
 * Engine-best for both sides often never demonstrates Philidor or Vancura.
 */
export function pickDefenseUserSan(
  position: TheoreticalEndgamePosition,
  sans: string[],
): string | null {
  if (position.objective !== 'DRAW') return null;
  let game: Chess;
  try {
    game = new Chess(position.initialFen);
    for (const san of sans) game.move(san);
  } catch {
    return null;
  }
  const user = position.playerColor === 'white' ? 'w' : 'b';
  if (game.turn() !== user) return null;
  const legal = game.moves();
  let best: { san: string; complete: boolean; demonstrated: boolean; slack: number } | null = null;
  for (const san of legal) {
    const assessment = assessDefense({
      themeId: position.themeId,
      initialFen: position.initialFen,
      sans: [...sans, san],
      playerColor: position.playerColor,
      objective: 'DRAW',
    });
    if (!assessment.applicable) continue;
    const candidate = {
      san,
      complete: assessment.complete,
      demonstrated: assessment.demonstrated,
      slack: assessment.slackMoves,
    };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.complete !== best.complete) {
      if (candidate.complete) best = candidate;
      continue;
    }
    if (candidate.demonstrated !== best.demonstrated) {
      if (candidate.demonstrated) best = candidate;
      continue;
    }
    if (candidate.slack < best.slack) best = candidate;
  }
  if (!best) return null;
  if (best.complete || best.demonstrated) return best.san;
  return null;
}

function engineMoveArgs(best: { from: string; to: string; promotion?: string }) {
  return {
    from: best.from,
    to: best.to,
    ...(best.promotion ? { promotion: best.promotion as 'q' | 'r' | 'b' | 'n' } : {}),
  };
}

export async function playTowardObjective(
  position: TheoreticalEndgamePosition,
  analyzer: DefenseAnalyzer,
  options: { movetimeMs?: number; maxUserMoves?: number } = {},
): Promise<PlayTowardResult> {
  const cap = options.maxUserMoves ?? playCapFor(position);
  const movetime = options.movetimeMs ?? 250;
  const game = new Chess(position.initialFen);
  const user = position.playerColor === 'white' ? 'w' : 'b';
  const sans: string[] = [];
  let userMoves = 0;
  let cause: PlayFinishCause | null = null;

  const snapshot = (): PlayTowardResult => ({
    outcome: 'interrupted',
    cause: cause ?? 'cap',
    sans,
    userMoves,
    endFen: game.fen(),
    cap,
  });

  while (!game.isGameOver() && userMoves < cap) {
    const side = game.turn();
    let played: { san: string } | null = null;
    if (side === user && position.objective === 'DRAW') {
      const defenseSan = pickDefenseUserSan(position, sans);
      if (defenseSan) {
        try {
          played = game.move(defenseSan);
        } catch {
          played = null;
        }
      }
    }
    if (
      !played &&
      side === user &&
      gradeFamilyFor(position.themeId, position.objective) === 'pawn-win'
    ) {
      const progressSan = pickPawnWinUserSan({
        themeId: position.themeId,
        initialFen: position.initialFen,
        sans,
        playerColor: position.playerColor,
        objective: position.objective,
      });
      if (progressSan) {
        try {
          played = game.move(progressSan);
        } catch {
          played = null;
        }
      }
    }
    if (!played) {
      const result = await analyzer.analyze(game.fen(), movetime);
      const best = result.bestMove;
      if (!best) {
        cause = 'engine-no-move';
        return snapshot();
      }
      try {
        if (
          gradeFamilyFor(position.themeId, position.objective) === 'pawn-win' &&
          best.promotion &&
          best.promotion !== 'q'
        ) {
          try {
            played = game.move(engineMoveArgs({ ...best, promotion: 'q' }));
          } catch {
            played = null;
          }
        }
        if (!played) played = game.move(engineMoveArgs(best));
      } catch {
        played = null;
      }
      if (!played) {
        cause = 'engine-illegal-move';
        return snapshot();
      }
    }
    sans.push(played.san);
    if (side === user) userMoves += 1;

    if (position.objective === 'DRAW') {
      const defense = assessDefense({
        themeId: position.themeId,
        initialFen: position.initialFen,
        sans,
        playerColor: position.playerColor,
        objective: 'DRAW',
      });
      if (defense.complete) {
        return {
          outcome: 'success',
          cause: 'mechanism',
          sans,
          userMoves,
          endFen: game.fen(),
          cap,
        };
      }
    }
  }

  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    const won = winner === user;
    return {
      outcome: won ? 'success' : 'theoretical-loss',
      cause: 'checkmate',
      sans,
      userMoves,
      endFen: game.fen(),
      cap,
    };
  }
  if (game.isDraw()) {
    const success = position.objective === 'DRAW';
    return {
      outcome: success ? 'success' : 'theoretical-loss',
      cause: 'draw',
      sans,
      userMoves,
      endFen: game.fen(),
      cap,
    };
  }
  return {
    outcome: 'interrupted',
    cause: 'cap',
    sans,
    userMoves,
    endFen: game.fen(),
    cap,
  };
}

/** Replay a stored complete line. Illegal SAN is an interruption, not a grade. */
export function replayRecordedLine(
  position: TheoreticalEndgamePosition,
  sans: string[],
): PlayTowardResult {
  const game = new Chess(position.initialFen);
  const user = position.playerColor === 'white' ? 'w' : 'b';
  const played: string[] = [];
  let userMoves = 0;
  for (const san of sans) {
    const side = game.turn();
    let move: { san: string } | null = null;
    try {
      move = game.move(san);
    } catch {
      move = null;
    }
    if (!move) {
      return {
        outcome: 'interrupted',
        cause: 'engine-illegal-move',
        sans: played,
        userMoves,
        endFen: game.fen(),
        cap: sans.length,
      };
    }
    played.push(move.san);
    if (side === user) userMoves += 1;
  }
  if (position.objective === 'DRAW') {
    const defense = assessDefense({
      themeId: position.themeId,
      initialFen: position.initialFen,
      sans: played,
      playerColor: position.playerColor,
      objective: 'DRAW',
    });
    if (defense.complete) {
      return {
        outcome: 'success',
        cause: 'mechanism',
        sans: played,
        userMoves,
        endFen: game.fen(),
        cap: played.length,
      };
    }
  }
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'b' : 'w';
    return {
      outcome: winner === user ? 'success' : 'theoretical-loss',
      cause: 'checkmate',
      sans: played,
      userMoves,
      endFen: game.fen(),
      cap: played.length,
    };
  }
  if (game.isDraw()) {
    return {
      outcome: position.objective === 'DRAW' ? 'success' : 'theoretical-loss',
      cause: 'draw',
      sans: played,
      userMoves,
      endFen: game.fen(),
      cap: played.length,
    };
  }
  return {
    outcome: 'interrupted',
    cause: 'cap',
    sans: played,
    userMoves,
    endFen: game.fen(),
    cap: played.length,
  };
}
