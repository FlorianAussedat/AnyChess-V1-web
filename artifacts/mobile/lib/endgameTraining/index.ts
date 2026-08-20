export type { EndgameTrainingPosition, AttemptResult, EvaluationPoint, EndgameSource } from './domain/types.ts';
export { ENDGAME_TRAINING_CONFIG } from './domain/types.ts';
export {
  normalizeForDefender,
  formatPlayerEval,
  gaugeFillRatio,
  defenderToSide,
  sideToMoveFromFen,
} from './domain/EvaluationNormalizer.ts';
export {
  createCounterState,
  registerSafePlayerMove,
  registerConfirmedLoss,
  crossesLossThreshold,
  findFirstMajorTurn,
  progressiveDeteriorationMessage,
} from './domain/AttemptScoring.ts';
export { EndgameTrainingSession } from './session/EndgameTrainingSession.ts';
export type { SessionSnapshot, SessionPhase } from './session/EndgameTrainingSession.ts';
export { chooseOpponentMove, pickPracticalPressureMove } from './engine/PracticalPressurePolicy.ts';
export { verifyLoss } from './engine/LossVerifier.ts';
export {
  loadEndgameStore,
  getShowGauge,
  setShowGauge,
  addToTryAgain,
  removeFromTryAgain,
  isInTryAgain,
  getTryAgainIds,
  recordFinishedAttempt,
  getPositionStats,
  getFinishedIds,
  getVarietyContext,
  clearEndgameStoreCache,
  configureEndgameStoreStorage,
  resetEndgameStoreStorage,
} from './persistence/EndgameTrainingStore.ts';
export type { PositionAttemptStats } from './persistence/EndgameTrainingStore.ts';
export {
  listPool,
  getPositionById,
  pickNewPosition,
  pickTryAgainPosition,
} from './selection/selectors.ts';
export { ENDGAME_TRAINING_POOL } from './data/pool.generated.ts';
export {
  openEndgameInReader,
  getEndgameAnalysisOverlay,
  clearEndgameAnalysisOverlay,
} from './review/EndgameAnalysisAdapter.ts';
export type { EndgameAnalysisPayload } from './review/EndgameAnalysisAdapter.ts';
