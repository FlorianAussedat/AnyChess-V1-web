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
  type SharedReaderPosition,
} from './sharedReaderPosition.ts';
