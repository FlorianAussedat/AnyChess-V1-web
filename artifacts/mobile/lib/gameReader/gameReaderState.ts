/**
 * Pure navigation helpers for the shared game reader.
 * Navigation follows the active variation line (not only the flat main line).
 * Previous/next/start/end preserve the chosen branch; only goToNode switches.
 */
import type {
  GameReaderState,
  ReaderColor,
  ReaderGame,
  ReaderMove,
  ReaderNode,
} from './types.ts';

function sideFromFen(fen: string): ReaderColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function nodeToMove(node: ReaderNode, ply: number): ReaderMove {
  return {
    ply,
    moveNumber: node.moveNumber,
    color: node.color,
    san: node.san,
    fenBefore: node.fenBefore,
    fenAfter: node.fenAfter,
    from: node.from,
    to: node.to,
    promotion: node.promotion,
    comment: node.comment,
    nags: node.nags,
    hasVariations: node.childIds.length > 1 || undefined,
    nodeId: node.id,
  };
}

/** Walk main children from a root id to build a full line. */
export function followMainFrom(
  game: ReaderGame,
  startId: string | null,
): string[] {
  const line: string[] = [];
  let id = startId;
  while (id) {
    line.push(id);
    const node = game.nodesById[id];
    id = node?.childIds[0] ?? null;
  }
  return line;
}

/**
 * Build the active line that passes through `nodeId` (or main line if null):
 * ancestors → node → main continuation to the end of that branch.
 */
export function buildActiveLine(
  game: ReaderGame,
  nodeId: string | null,
): string[] {
  if (!nodeId) {
    return followMainFrom(game, game.rootIds[0] ?? null);
  }
  if (!game.nodesById[nodeId]) {
    return followMainFrom(game, game.rootIds[0] ?? null);
  }

  const ancestors: string[] = [];
  let cursor: string | null = nodeId;
  while (cursor) {
    ancestors.unshift(cursor);
    cursor = game.nodesById[cursor]?.parentId ?? null;
  }

  const forward: string[] = [];
  cursor = game.nodesById[nodeId]?.childIds[0] ?? null;
  while (cursor) {
    forward.push(cursor);
    cursor = game.nodesById[cursor]?.childIds[0] ?? null;
  }
  return [...ancestors, ...forward];
}

export function clampReaderPly(game: ReaderGame, ply: number, lineLength?: number): number {
  const total = lineLength ?? game.moves.length;
  if (!Number.isFinite(ply)) return 0;
  return Math.max(0, Math.min(Math.floor(ply), total));
}

export function fenAtReaderPly(game: ReaderGame, ply: number): string {
  const line = buildActiveLine(game, null);
  const safe = clampReaderPly(game, ply, line.length);
  if (safe <= 0) return game.initialFen;
  const node = game.nodesById[line[safe - 1]!];
  return node?.fenAfter ?? game.initialFen;
}

export function moveAtReaderPly(
  game: ReaderGame,
  ply: number,
): ReaderMove | null {
  const line = buildActiveLine(game, null);
  if (ply < 1 || ply > line.length) return null;
  const node = game.nodesById[line[ply - 1]!];
  return node ? nodeToMove(node, ply) : null;
}

export function lastMoveSquaresAtPly(
  game: ReaderGame,
  ply: number,
): { from: string; to: string } | null {
  const move = moveAtReaderPly(game, ply);
  if (!move?.from || !move?.to) return null;
  return { from: move.from, to: move.to };
}

function moveOnLine(
  game: ReaderGame,
  line: string[],
  ply: number,
): ReaderMove | null {
  if (ply < 1 || ply > line.length) return null;
  const node = game.nodesById[line[ply - 1]!];
  return node ? nodeToMove(node, ply) : null;
}

/**
 * Build reader state on a *fixed* active line (preserves side variations).
 * Prefer this for prev/next/start/end so ancestors don't snap back to main.
 */
export function stateFromActiveLine(
  game: ReaderGame,
  activeLineNodeIds: string[],
  ply: number,
  boardFlipped = false,
): GameReaderState {
  const line =
    activeLineNodeIds.length > 0
      ? activeLineNodeIds
      : buildActiveLine(game, null);
  const totalPly = line.length;
  const currentPly = clampReaderPly(game, ply, totalPly);
  const currentNodeId =
    currentPly > 0 ? (line[currentPly - 1] ?? null) : null;
  const currentMove = moveOnLine(game, line, currentPly);
  const previousMove = moveOnLine(game, line, currentPly - 1);
  const nextMove = moveOnLine(game, line, currentPly + 1);
  const currentFen =
    currentPly <= 0
      ? game.initialFen
      : (game.nodesById[line[currentPly - 1]!]?.fenAfter ?? game.initialFen);

  return {
    game,
    currentPly,
    totalPly,
    currentFen,
    currentMove,
    previousMove,
    nextMove,
    currentSan: currentMove?.san ?? null,
    currentMoveNumber: currentMove?.moveNumber ?? null,
    sideToMove: sideFromFen(currentFen),
    lastMoveSquares:
      currentMove?.from && currentMove?.to
        ? { from: currentMove.from, to: currentMove.to }
        : null,
    canGoBack: currentPly > 0,
    canGoForward: currentPly < totalPly,
    boardFlipped,
    currentNodeId,
    activeLineNodeIds: line,
  };
}

/**
 * Create reader state.
 * - If `nodeId` is provided, active line passes through that node; ply is derived.
 * - Else ply indexes the main line (rootIds[0] path).
 */
export function createGameReaderState(
  game: ReaderGame,
  plyOrNode: number | string | null = 0,
  boardFlipped = false,
): GameReaderState {
  if (typeof plyOrNode === 'string') {
    const currentNodeId = game.nodesById[plyOrNode] ? plyOrNode : null;
    const activeLineNodeIds = buildActiveLine(game, currentNodeId);
    const currentPly = currentNodeId
      ? activeLineNodeIds.indexOf(currentNodeId) + 1
      : 0;
    return stateFromActiveLine(
      game,
      activeLineNodeIds,
      Math.max(0, currentPly),
      boardFlipped,
    );
  }

  const activeLineNodeIds = buildActiveLine(game, null);
  const currentPly = clampReaderPly(game, plyOrNode ?? 0, activeLineNodeIds.length);
  return stateFromActiveLine(game, activeLineNodeIds, currentPly, boardFlipped);
}

export function goToStart(state: GameReaderState): GameReaderState {
  return stateFromActiveLine(
    state.game,
    state.activeLineNodeIds,
    0,
    state.boardFlipped,
  );
}

export function goToEnd(state: GameReaderState): GameReaderState {
  const line =
    state.activeLineNodeIds.length > 0
      ? state.activeLineNodeIds
      : buildActiveLine(state.game, null);
  return stateFromActiveLine(
    state.game,
    line,
    line.length,
    state.boardFlipped,
  );
}

export function goToPrevious(state: GameReaderState): GameReaderState {
  return stateFromActiveLine(
    state.game,
    state.activeLineNodeIds,
    Math.max(0, state.currentPly - 1),
    state.boardFlipped,
  );
}

export function goToNext(state: GameReaderState): GameReaderState {
  return stateFromActiveLine(
    state.game,
    state.activeLineNodeIds,
    Math.min(state.activeLineNodeIds.length, state.currentPly + 1),
    state.boardFlipped,
  );
}

export function goToPly(state: GameReaderState, ply: number): GameReaderState {
  return stateFromActiveLine(
    state.game,
    state.activeLineNodeIds,
    ply,
    state.boardFlipped,
  );
}

/** Jump to a specific tree node (selects that branch as active). */
export function goToNode(
  state: GameReaderState,
  nodeId: string | null,
): GameReaderState {
  if (!nodeId) {
    return createGameReaderState(state.game, 0, state.boardFlipped);
  }
  return createGameReaderState(state.game, nodeId, state.boardFlipped);
}

export function flipBoard(state: GameReaderState): GameReaderState {
  return {
    ...state,
    boardFlipped: !state.boardFlipped,
  };
}

export function setBoardFlipped(
  state: GameReaderState,
  flipped: boolean,
): GameReaderState {
  return {
    ...state,
    boardFlipped: flipped,
  };
}

/** Replace the game tree while preserving node/line when possible. */
export function replaceReaderGame(
  state: GameReaderState,
  game: ReaderGame,
): GameReaderState {
  const nodeId =
    state.currentNodeId && game.nodesById[state.currentNodeId]
      ? state.currentNodeId
      : null;
  if (nodeId) {
    return createGameReaderState(game, nodeId, state.boardFlipped);
  }
  const kept = state.activeLineNodeIds.filter((id) => game.nodesById[id]);
  if (kept.length > 0) {
    return stateFromActiveLine(
      game,
      buildActiveLine(game, kept[kept.length - 1]!),
      Math.min(state.currentPly, kept.length),
      state.boardFlipped,
    );
  }
  return createGameReaderState(game, 0, state.boardFlipped);
}
