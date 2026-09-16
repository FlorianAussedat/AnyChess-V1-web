/**
 * Play-turn state machine shared conceptually by Classic / Openings.
 *
 * Theory/training phases stay in OpeningOpponent (`OpeningTrainingState`).
 * This enum only covers whose turn / async opponent work — so we never
 * combine independent booleans into impossible states (e.g. waiting + thinking).
 */

export type PlayTurnState =
  | 'waitingForUser'
  | 'playingRepertoireReply'
  | 'waitingForEngine'
  | 'awaitingTheoryDecision'
  | 'finished'
  | 'error';

export type PlayTurnFlags = {
  waitingForUser: boolean;
  isOpponentThinking: boolean;
  deciding: boolean;
  canAct: boolean;
};

export function flagsFromPlayTurn(
  state: PlayTurnState,
  isGameOver = false,
): PlayTurnFlags {
  if (isGameOver || state === 'finished') {
    return {
      waitingForUser: false,
      isOpponentThinking: false,
      deciding: false,
      canAct: false,
    };
  }
  const waitingForUser = state === 'waitingForUser';
  const isOpponentThinking =
    state === 'playingRepertoireReply' || state === 'waitingForEngine';
  const deciding = state === 'awaitingTheoryDecision';
  return {
    waitingForUser,
    isOpponentThinking,
    deciding,
    canAct: waitingForUser,
  };
}

/** Opponent search phase based on openings training state. */
export function opponentSearchTurn(
  trainingState: string,
): Extract<PlayTurnState, 'playingRepertoireReply' | 'waitingForEngine'> {
  return trainingState === 'engineContinuation'
    ? 'waitingForEngine'
    : 'playingRepertoireReply';
}

/** After undo: either wait for the user or kick off the opponent. */
export function playTurnAfterUndo(needsOpponentKickoff: boolean): PlayTurnState {
  return needsOpponentKickoff ? 'waitingForEngine' : 'waitingForUser';
}

/**
 * When pickMove returns null: theory decision vs engine failure vs idle.
 */
export function playTurnAfterEmptyOpponentPick(
  trainingState: string,
): PlayTurnState {
  if (trainingState === 'lineComplete' || trainingState === 'outOfTheory') {
    return 'awaitingTheoryDecision';
  }
  if (trainingState === 'engineContinuation') {
    return 'error';
  }
  return 'waitingForUser';
}
