/**
 * Shared route / mode identifiers for the main menu and nested hubs.
 * Keep display labels separate so copy can change without breaking routes.
 */
export type MainModeId =
  | 'classic'
  | 'openings'
  | 'blind'
  | 'puzzles'
  | 'visualisation'
  | 'quiz-ouverture'
  | 'parties';

export type VisualisationExerciseId = 'mental' | 'nommer' | 'jouer' | 'records';

export type QuizOuvertureExerciseId = 'quelle' | 'defends-nulle';

export type OpeningsExerciseId = 'play' | 'continue-line' | 'manage-pgn';
