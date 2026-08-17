export {
  DEFEND_DRAW_TARGET_MOVES,
  defensivePrecision,
  invertVerdict,
  verdictFromCp,
} from './wdl.ts';
export type { WdlProbeResult, WdlSource, WdlVerdict } from './wdl.ts';
export {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
  DEFEND_DRAW_POSITIONS,
  opponentEloForDifficulty,
  opponentMoveTimeMs,
} from './positions.ts';
export type { DefendDrawPosition } from './positions.ts';
export {
  DefendDrawPoolEmptyError,
  EndgamePositionRepository,
  endgamePositionRepository,
  endgamesForDifficulty,
  getDefendDrawPosition,
  listCertifiedEndgames,
  pickCertifiedEndgame,
  pickDefendDrawPosition,
  positionsForDifficulty,
} from './EndgamePositionRepository.ts';
export type { CertifiedEndgamePosition } from './EndgamePositionRepository.ts';
export {
  annotatePrecision,
  isDeadOrTrivialHold,
  isDeadOppositeBishopHold,
  isEligibleDefendDrawPosition,
  isTrivialDefendDrawPosition,
  isTrivialInsufficientMaterial,
  opponentLacksPracticalPressure,
  precisionFitsDifficulty,
} from './defensivePrecision.ts';
export {
  isDefendDrawStartLegal,
  validateDefendDrawFen,
} from './fenValidation.ts';
export {
  evaluateRegulatoryEnd,
  isRegulatoryDraw,
  regulatorySuccessMessage,
} from './gameEnd.ts';
export type {
  RegulatoryEnd,
  RegulatoryEndKind,
  RegulatorySuccessKind,
} from './gameEnd.ts';
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
