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
  EndgamePositionRepository,
  endgamePositionRepository,
  endgamesForDifficulty,
  listCertifiedEndgames,
  pickCertifiedEndgame,
} from './EndgamePositionRepository.ts';
export type { CertifiedEndgamePosition } from './EndgamePositionRepository.ts';
export {
  annotatePrecision,
  isDeadOrTrivialHold,
  isEligibleDefendDrawPosition,
  isTrivialInsufficientMaterial,
  precisionFitsDifficulty,
} from './defensivePrecision.ts';
export {
  CLEARLY_LOST_CP_MAX,
  CLEARLY_LOST_MIN_DEPTH,
  CLEARLY_LOST_STREAK_REQUIRED,
  CLEARLY_LOST_WDL_DRAW_MAX,
  CLEARLY_LOST_WDL_LOSS_MIN,
  evaluateClearlyLostSignal,
  isClearlyLostPosition,
} from './isClearlyLostPosition.ts';
export type {
  ClearlyLostReason,
  ClearlyLostVerdict,
} from './isClearlyLostPosition.ts';
export {
  DEFEND_DRAW_ENGINE_CONFIG,
  defendDrawMoveTimeMs,
} from './engineConfig.ts';
export type {
  DefenseAnalysis,
  DefenseAnalyzer,
  DefenseBestMove,
} from './defenseTypes.ts';
export { createMockDefenseAnalyzer } from './mockDefenseAnalyzer.ts';
export { StockfishAnalysisService } from './StockfishAnalysisService.ts';
export type { StockfishAnalysisServiceOptions } from './StockfishAnalysisService.ts';
export { DefendDrawSession } from './DefendDrawSession.ts';
export type {
  DefendDrawPhase,
  DefendDrawSessionOptions,
  DefendDrawSnapshot,
} from './DefendDrawSession.ts';
// Legacy helpers kept for offline tooling / tests (not used mid-game by session).
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
