export {
  DEFEND_DRAW_TARGET_MOVES,
  defensivePrecision,
  invertVerdict,
  verdictFromCp,
} from './wdl.ts';
export type { WdlProbeResult, WdlSource, WdlVerdict } from './wdl.ts';
export {
  DEFEND_DRAW_POSITIONS,
  opponentEloForDifficulty,
  opponentMoveTimeMs,
  pickDefendDrawPosition,
  positionsForDifficulty,
} from './positions.ts';
export type { DefendDrawPosition } from './positions.ts';
export {
  annotatePrecision,
  isDeadOrTrivialHold,
  isEligibleDefendDrawPosition,
  isTrivialInsufficientMaterial,
  precisionFitsDifficulty,
} from './defensivePrecision.ts';
export {
  countDrawingMoves,
  heuristicWdl,
  probeTablebaseMoves,
  probeWdl,
  probeWdlForPlayer,
} from './WdlProbe.ts';
export type {
  StockfishEvalFn,
  TablebaseMove,
  WdlProbeOptions,
} from './WdlProbe.ts';
export { pickOpponentMove } from './opponentMove.ts';
export type {
  OpponentPick,
  PickOpponentMoveOptions,
  StockfishPickFn,
} from './opponentMove.ts';
export { DefendDrawSession } from './DefendDrawSession.ts';
export type {
  DefendDrawPhase,
  DefendDrawSessionOptions,
  DefendDrawSnapshot,
} from './DefendDrawSession.ts';
