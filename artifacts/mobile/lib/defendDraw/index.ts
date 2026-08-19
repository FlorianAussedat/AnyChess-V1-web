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
export type { DefendDrawPosition, EndgameObjective } from './positions.ts';
export {
  DEFEND_DRAW_DIFFICULTIES,
  ENDGAME_CONCEPTS,
  ENDGAME_FAMILIES,
  isEndgameConcept,
  isEndgameFamily,
  resolveDefendDrawDifficulty,
} from './taxonomy.ts';
export type {
  DefendDrawDifficulty,
  DefendDrawDifficultyAlias,
  DefendDrawSource,
  DifficultyMetrics,
  EndgameConcept,
  EndgameFamily,
} from './taxonomy.ts';
export { pickVariedCertifiedPosition } from './variety.ts';
export { analyzeDrawingWalk } from './analyzeDifficulty.ts';
export type { DrawWalkMetrics } from './analyzeDifficulty.ts';
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
  isStructurallyTrivialDefendDraw,
  isTrivialDefendDrawPosition,
  isTrivialInsufficientMaterial,
  opponentLacksPracticalPressure,
  precisionFitsDifficulty,
} from './defensivePrecision.ts';
export {
  hasProvenDrawCertification,
  isAcceptableVerifiedDrawFlag,
  STOCKFISH_CERT_ENGINE_LABEL,
  STOCKFISH_CERT_MAX_ABS_CP,
  STOCKFISH_CERT_MIN_DEPTH,
  SYZYGY_MAX_PIECES,
} from './certification.ts';
export type {
  DefendDrawVerification,
  DefendDrawVerificationMethod,
} from './certification.ts';
export {
  certifyDefendDrawPosition,
  validateDefendDrawBase,
} from './certifyPosition.ts';
export type {
  CertifyBaseInput,
  CertifyPositionOptions,
  CertifyPositionResult,
  StockfishCertAnalysis,
} from './certifyPosition.ts';
export {
  isDefendDrawStartLegal,
  validateDefendDrawFen,
} from './fenValidation.ts';
export {
  evaluateRegulatoryEnd,
  isObjectiveSuccess,
  isRegulatoryDraw,
  objectiveFeedbackMessage,
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
  EndgamePhase,
  EndgameSessionOptions,
  EndgameSnapshot,
} from './DefendDrawSession.ts';
export { findFirstError } from './firstError.ts';
export type { FirstErrorResult } from './firstError.ts';
export {
  canOfferDraw,
  evaluateDrawOffer,
  DRAW_OFFER_CONFIG,
} from './drawOffer.ts';
export type { DrawOfferResult } from './drawOffer.ts';
export {
  isFavorite,
  toggleFavorite,
  getFavoriteIds,
  removeFavorite,
  clearFavoritesCache,
} from './favoritesStore.ts';
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
