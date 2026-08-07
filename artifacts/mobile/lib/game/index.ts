export type {
  BoardPiece,
  LastMove,
  MoveEvent,
  MoveRow,
  PlayerColor,
  SideChoice,
} from './types.ts';
export { looksLikeChessMove } from './looksLikeChessMove.ts';
export { legalDestinationsForSquare } from './legalDestinations.ts';
export { pairMoveHistory } from './pairMoveHistory.ts';
export { resolveSideChoice } from './resolveSideChoice.ts';
export { campFromSquareTap, CAMP_PICKER_START_FEN } from './boardCampPicker.ts';
export { beginGameFromCampChoice } from './campSelectionFlow.ts';
export type { CampSelectionResult } from './campSelectionFlow.ts';
export { campZoneRects } from './campZoneRects.ts';
export type { CampZoneRect } from './campZoneRects.ts';
export {
  computeBoardSize,
  DEFAULT_BOARD_MAX_SIZE,
  MIN_BOARD_SIZE,
} from './boardSize.ts';
export type { BoardSizeMode } from './boardSize.ts';
export { speakMoveHistorySummary } from './speakMoveHistory.ts';
export { undoPlayerTurn, type UndoPlayerTurnResult } from './undoPlayerTurn.ts';
export {
  applyUserMoveInput,
  type ApplyUserMoveInputResult,
} from './applyUserMoveInput.ts';
