/**
 * Pure finish-vs-engine controller.
 * Testable in Node without React or jsdom. History is kept on a Chess instance
 * so threefold repetition and the 50-move rule can be detected.
 */
import { Chess, type Move } from 'chess.js';

export type FinishColor = 'white' | 'black';

export type FinishMoveInput =
  | { san: string }
  | { from: string; to: string; promotion?: string };

export type FinishGamePhase = 'playing' | 'game-over' | 'error' | 'closed';

export type FinishGameState = {
  phase: FinishGamePhase;
  fen: string;
  playerColor: FinishColor;
  engineColor: FinishColor;
  generation: number;
  requestToken: number | null;
  engineThinking: boolean;
  result: string | null;
  error: string | null;
  historySans: string[];
  closed: boolean;
  resultEmitted: boolean;
  exerciseScoreRecorded: false;
};

export type EngineMoveRequest = {
  requested: boolean;
  token: number | null;
  fen: string;
  generation: number;
};

export type FinishGameControllerConfig = {
  initialFen: string;
  playerColor: FinishColor;
  engineColor: FinishColor;
  openingSans?: readonly string[];
  timeoutMs?: number;
  onStateChange?: (state: FinishGameState) => void;
};

export type FinishGameController = {
  submitPlayerMove: (move: FinishMoveInput) => boolean;
  requestEngineMoveIfNeeded: () => EngineMoveRequest;
  receiveEngineMove: (token: number, fen: string, move: FinishMoveInput) => boolean;
  receiveEngineError: (token: number, error: string) => boolean;
  receiveTimeout: (token: number) => boolean;
  close: () => void;
  getState: () => FinishGameState;
  legalDestinations: (from: string) => string[];
};

function sideFromFen(fen: string): FinishColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function cloneState(state: FinishGameState): FinishGameState {
  return {
    ...state,
    historySans: [...state.historySans],
    exerciseScoreRecorded: false,
  };
}

function officialResultFromChess(chess: Chess): string | null {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? '0-1' : '1-0';
  if (chess.isStalemate()) return '1/2-1/2';
  if (chess.isInsufficientMaterial()) return '1/2-1/2';
  if (chess.isThreefoldRepetition()) return '1/2-1/2';
  if (typeof chess.isDrawByFiftyMoves === 'function' && chess.isDrawByFiftyMoves()) {
    return '1/2-1/2';
  }
  if (chess.isDraw()) return '1/2-1/2';
  return null;
}

function tryPlay(chess: Chess, move: FinishMoveInput): Move | null {
  try {
    if ('san' in move) {
      return (chess.move(move.san) as Move | null) ?? null;
    }
    return (
      (chess.move({
        from: move.from,
        to: move.to,
        promotion: (move.promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
      }) as Move | null) ?? null
    );
  } catch {
    return null;
  }
}

export function createFinishGameController(
  config: FinishGameControllerConfig,
): FinishGameController {
  const chess = new Chess(config.initialFen);
  for (const san of config.openingSans ?? []) {
    const played = chess.move(san);
    if (!played) {
      throw new Error(`Illegal opening move "${san}".`);
    }
  }

  let tokenSeq = 0;
  let outstanding: { token: number; fen: string; generation: number } | null = null;

  let state: FinishGameState = {
    phase: 'playing',
    fen: chess.fen(),
    playerColor: config.playerColor,
    engineColor: config.engineColor,
    generation: 0,
    requestToken: null,
    engineThinking: false,
    result: officialResultFromChess(chess),
    error: null,
    historySans: [...(config.openingSans ?? [])],
    closed: false,
    resultEmitted: false,
    exerciseScoreRecorded: false,
  };

  if (state.result) {
    state = {
      ...state,
      phase: 'game-over',
      resultEmitted: true,
    };
  }

  const emit = (): void => {
    config.onStateChange?.(cloneState(state));
  };

  const snapshotRequest = (requested: boolean): EngineMoveRequest => ({
    requested,
    token: outstanding?.token ?? null,
    fen: state.fen,
    generation: state.generation,
  });

  const finishIfNeeded = (): void => {
    if (state.resultEmitted) return;
    const official = officialResultFromChess(chess);
    if (!official) return;
    state = {
      ...state,
      phase: 'game-over',
      fen: chess.fen(),
      result: official,
      resultEmitted: true,
      engineThinking: false,
      requestToken: null,
    };
    outstanding = null;
  };

  const applyLegalMove = (move: FinishMoveInput): boolean => {
    if (state.closed || state.phase !== 'playing') return false;
    const played = tryPlay(chess, move);
    if (!played) return false;
    outstanding = null;
    state = {
      ...state,
      fen: chess.fen(),
      generation: state.generation + 1,
      requestToken: null,
      engineThinking: false,
      error: null,
      historySans: [...state.historySans, played.san],
    };
    finishIfNeeded();
    emit();
    return true;
  };

  const rejectStaleOrClosed = (token: number, fen?: string): boolean => {
    if (state.closed || state.phase === 'closed') return true;
    if (!outstanding) return true;
    if (outstanding.token !== token) return true;
    if (outstanding.generation !== state.generation) return true;
    if (fen != null && (outstanding.fen !== fen || state.fen !== fen)) return true;
    return false;
  };

  const submitPlayerMove = (move: FinishMoveInput): boolean => {
    if (state.closed || state.phase !== 'playing') return false;
    if (sideFromFen(state.fen) !== state.playerColor) return false;
    if (state.engineThinking) return false;
    return applyLegalMove(move);
  };

  const requestEngineMoveIfNeeded = (): EngineMoveRequest => {
    if (state.closed || state.phase !== 'playing') {
      return snapshotRequest(false);
    }
    if (sideFromFen(state.fen) !== state.engineColor) {
      return snapshotRequest(false);
    }
    if (outstanding && outstanding.fen === state.fen && outstanding.generation === state.generation) {
      return snapshotRequest(false);
    }
    tokenSeq += 1;
    outstanding = {
      token: tokenSeq,
      fen: state.fen,
      generation: state.generation,
    };
    state = {
      ...state,
      requestToken: tokenSeq,
      engineThinking: true,
    };
    emit();
    return snapshotRequest(true);
  };

  const receiveEngineMove = (
    token: number,
    fen: string,
    move: FinishMoveInput,
  ): boolean => {
    if (rejectStaleOrClosed(token, fen)) return false;
    if (sideFromFen(state.fen) !== state.engineColor) return false;
    const preview = new Chess(chess.fen());
    const legal = tryPlay(preview, move);
    if (!legal) {
      outstanding = null;
      state = {
        ...state,
        phase: 'error',
        engineThinking: false,
        requestToken: null,
        error: 'illegal-engine-move',
      };
      emit();
      return false;
    }
    return applyLegalMove(move);
  };

  const failOutstanding = (token: number, error: string): boolean => {
    if (rejectStaleOrClosed(token)) return false;
    outstanding = null;
    state = {
      ...state,
      phase: 'error',
      engineThinking: false,
      requestToken: null,
      error,
    };
    emit();
    return true;
  };

  const receiveEngineError = (token: number, error: string): boolean =>
    failOutstanding(token, error);

  const receiveTimeout = (token: number): boolean => failOutstanding(token, 'timeout');

  const close = (): void => {
    outstanding = null;
    state = {
      ...state,
      phase: 'closed',
      closed: true,
      engineThinking: false,
      requestToken: null,
    };
    emit();
  };

  const getState = (): FinishGameState => cloneState(state);

  const legalDestinations = (from: string): string[] => {
    if (state.closed || state.phase !== 'playing') return [];
    if (sideFromFen(state.fen) !== state.playerColor) return [];
    try {
      return chess
        .moves({ square: from as never, verbose: true })
        .map((move) => move.to);
    } catch {
      return [];
    }
  };

  return {
    submitPlayerMove,
    requestEngineMoveIfNeeded,
    receiveEngineMove,
    receiveEngineError,
    receiveTimeout,
    close,
    getState,
    legalDestinations,
  };
}
