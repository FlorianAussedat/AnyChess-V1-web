export type {
  ReaderColor,
  ReaderMove,
  ReaderNode,
  ReaderHeaders,
  ReaderGame,
  GameReaderState,
  ParsePgnOk,
  ParsePgnErr,
  ParsePgnResult,
} from './types.ts';

export {
  STANDARD_START_FEN,
  buildReaderGameFromPgnTree,
  parseReaderPgn,
  readerGameFromImported,
  emptyReaderGame,
  type BuildReaderGameOptions,
} from './parseReaderPgn.ts';

export {
  clampReaderPly,
  fenAtReaderPly,
  moveAtReaderPly,
  lastMoveSquaresAtPly,
  createGameReaderState,
  goToStart,
  goToEnd,
  stateFromActiveLine,
  replaceReaderGame,
  goToPrevious,
  goToNext,
  goToPly,
  flipBoard,
  setBoardFlipped,
  goToNode,
  buildActiveLine,
  followMainFrom,
} from './gameReaderState.ts';

export {
  useGameReader,
  type UseGameReaderOptions,
  type GameReaderApi,
} from './useGameReader.ts';

export {
  parseReaderVoiceCommand,
  type ReaderVoiceCommand,
} from './parseReaderVoiceCommand.ts';

export {
  createReaderPlayback,
  type ReaderPlaybackController,
  type ReaderPlaybackDeps,
} from './readerPlayback.ts';

export {
  saveSharedReaderPosition,
  loadSharedReaderPosition,
  clearSharedReaderPosition,
  saveSharedGameSession,
  loadSharedGameSession,
  clearSharedGameSession,
  scheduleSaveSharedGameSession,
  flushSharedGameSession,
  peekSharedGameSession,
  validateSharedGameSession,
  SHARED_GAME_SESSION_VERSION,
  SHARED_GAME_SESSION_STORAGE_KEY,
  SHARED_GAME_SESSION_DEBOUNCE_MS,
  type SharedReaderPosition,
  type SharedGameSession,
  type SharedGameSessionInput,
  type SharedAnalysisCacheSummary,
} from './sharedReaderPosition.ts';

export {
  playMoveOnReader,
  returnToExplorationOrigin,
  EXPLORATION_ORIGIN_START,
} from './explorationMoves.ts';

export {
  buildNotationColumnRows,
  notationScrollIndexForNode,
  type NotationColumnRow,
  type NotationMoveCell,
  type NotationVariationBlock,
  type NotationVariationMove,
} from './notationColumns.ts';
