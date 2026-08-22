export type {
  TheoreticalEndgamePosition,
  TheoreticalAttemptResult,
  TheoreticalThemeId,
  TheoreticalObjective,
  CatalogViewMode,
} from './domain/types.ts';
export { THEORETICAL_ENDGAME_CONFIG } from './domain/types.ts';
export { THEORETICAL_THEMES, THEME_IDS, getTheme, isThemeId } from './domain/themes.ts';
export {
  scoreAttempt,
  averageComprehensionScore,
  isThemeMastered,
  formatComprehensionScore,
} from './domain/comprehensionScore.ts';
export { TheoreticalEndgameSession } from './session/TheoreticalEndgameSession.ts';
export type { SessionSnapshot, SessionPhase } from './session/TheoreticalEndgameSession.ts';
export {
  loadTheoreticalStore,
  getCatalogView,
  setCatalogView,
  getThemeAttempts,
  getThemeComprehension,
  getLastPositionId,
  recordAttempt,
  getAllThemeScores,
  clearTheoreticalStoreCache,
  configureTheoreticalStoreStorage,
} from './persistence/TheoreticalEndgameStore.ts';
export type { ThemeAttemptRecord } from './persistence/TheoreticalEndgameStore.ts';
export {
  listPool,
  getPositionById,
  listByTheme,
  pickPositionInTheme,
  pickRandomFromActiveThemes,
} from './selection/selectors.ts';
export { THEORETICAL_ENDGAME_POOL } from './data/pool.generated.ts';
export {
  openTheoreticalInReader,
  getTheoreticalAnalysisOverlay,
} from './review/TheoreticalAnalysisAdapter.ts';
export type { TheoreticalAnalysisPayload } from './review/TheoreticalAnalysisAdapter.ts';
