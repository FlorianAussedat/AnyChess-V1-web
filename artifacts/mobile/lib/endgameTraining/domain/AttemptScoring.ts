/**
 * Attempt scoring — player-move counter, −2 loss, 30-move win.
 * Pure functions — no engine I/O.
 */
import {
  ENDGAME_TRAINING_CONFIG,
  type AttemptOutcome,
  type AttemptResult,
  type EvaluationPoint,
  type FirstMajorTurn,
  type OfficialDrawReason,
} from './types.ts';

export type CounterState = {
  /** Safe player moves that counted toward the score. */
  movesResisted: number;
  outcome: AttemptOutcome;
  /** True once win-30 or official draw locked the score. */
  scoreLocked: boolean;
  /** Playing after a locked win (or after recorded loss). */
  offScore: boolean;
};

export function createCounterState(): CounterState {
  return {
    movesResisted: 0,
    outcome: 'in-progress',
    scoreLocked: false,
    offScore: false,
  };
}

/**
 * After a player move that is NOT a confirmed loss and NOT an official draw:
 * increment movesResisted (unless score already locked / off-score).
 * Returns win-30-moves when target reached.
 */
export function registerSafePlayerMove(state: CounterState): CounterState {
  if (state.scoreLocked || state.offScore || state.outcome !== 'in-progress') {
    return { ...state, offScore: state.scoreLocked ? true : state.offScore };
  }
  const movesResisted = state.movesResisted + 1;
  if (movesResisted >= ENDGAME_TRAINING_CONFIG.targetPlayerMoves) {
    return {
      movesResisted,
      outcome: 'win-30-moves',
      scoreLocked: true,
      offScore: false,
    };
  }
  return { ...state, movesResisted };
}

/** Losing move: do NOT increment movesResisted. */
export function registerConfirmedLoss(state: CounterState): CounterState {
  if (state.scoreLocked) {
    return { ...state, offScore: true };
  }
  return {
    ...state,
    outcome: 'loss',
    scoreLocked: true,
    offScore: false,
  };
}

export function registerOfficialDraw(
  state: CounterState,
): CounterState {
  if (state.scoreLocked && state.outcome !== 'in-progress') {
    return { ...state, offScore: true };
  }
  return {
    movesResisted: state.movesResisted,
    outcome: 'win-official-draw',
    scoreLocked: true,
    offScore: false,
  };
}

export function markAbandoned(state: CounterState): CounterState {
  if (state.scoreLocked) return state;
  return { ...state, outcome: 'abandoned' };
}

export function enterOffScore(state: CounterState): CounterState {
  if (!state.scoreLocked) return state;
  return { ...state, offScore: true };
}

/**
 * Raw player-POV score crosses the loss line (strictly under −2.00).
 * −2.00 exactly is NOT a loss; −2.01 is a candidate.
 */
export function crossesLossThreshold(scoreCp: number): boolean {
  return scoreCp < ENDGAME_TRAINING_CONFIG.lossThresholdCp;
}

export function findFirstMajorTurn(
  timeline: EvaluationPoint[],
): FirstMajorTurn | null {
  // Timeline[0] is initial; subsequent entries are after each player move.
  for (let i = 1; i < timeline.length; i++) {
    const before = timeline[i - 1]!;
    const after = timeline[i]!;
    const delta = after.scoreCp - before.scoreCp;
    if (delta <= ENDGAME_TRAINING_CONFIG.majorErrorDeltaCp) {
      const san = after.san ?? '?';
      return {
        playerMoveNumber: after.playerMoveNumber,
        san,
        scoreBefore: before.scoreCp,
        scoreAfter: after.scoreCp,
        delta,
        message: `Premier tournant : ${after.playerMoveNumber}.${san}`,
      };
    }
  }
  return null;
}

export function progressiveDeteriorationMessage(): string {
  return 'Aucune grosse erreur.\nLa position s’est détériorée petit à petit.';
}

export function buildAttemptResult(input: {
  state: CounterState;
  timeline: EvaluationPoint[];
  moveSans: string[];
  startFen: string;
  endFen: string;
  positionId: string;
  officialDrawReason?: OfficialDrawReason;
}): AttemptResult {
  const firstMajorTurn =
    input.state.outcome === 'loss'
      ? findFirstMajorTurn(input.timeline)
      : null;

  return {
    outcome: input.state.outcome,
    movesResisted: input.state.movesResisted,
    officialDrawReason: input.officialDrawReason,
    firstMajorTurn:
      input.state.outcome === 'loss'
        ? firstMajorTurn
        : undefined,
    timeline: input.timeline,
    moveSans: input.moveSans,
    startFen: input.startFen,
    endFen: input.endFen,
    positionId: input.positionId,
    finishedAt: new Date().toISOString(),
  };
}
