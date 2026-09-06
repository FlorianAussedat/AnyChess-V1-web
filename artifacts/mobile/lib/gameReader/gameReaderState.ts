/**
 * Pure navigation helpers for the shared game reader.
 * Navigation follows the active variation line (not only the flat main line).
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
 * Create reader state.
 * - If `nodeId` is provided, active line passes through that node; ply is derived.
 * - Else ply indexes the main line (rootIds[0] path).
 */
export function createGameReaderState(
  game: ReaderGame,
  plyOrNode: number | string | null = 0,
  boardFlipped = false,
): GameReaderState {
  let activeLineNodeIds: string[];
  let currentPly: number;
  let currentNodeId: string | null;

  if (typeof plyOrNode === 'string') {
    currentNodeId = game.nodesById[plyOrNode] ? plyOrNode : null;
    activeLineNodeIds = buildActiveLine(game, currentNodeId);
    currentPly = currentNodeId
      ? activeLineNodeIds.indexOf(currentNodeId) + 1
      : 0;
    if (currentPly < 0) currentPly = 0;
  } else {
    activeLineNodeIds = buildActiveLine(game, null);
    currentPly = clampReaderPly(game, plyOrNode ?? 0, activeLineNodeIds.length);
    currentNodeId =
      currentPly > 0 ? (activeLineNodeIds[currentPly - 1] ?? null) : null;
  }

  const totalPly = activeLineNodeIds.length;
  const currentMove = moveOnLine(game, activeLineNodeIds, currentPly);
  const previousMove = moveOnLine(game, activeLineNodeIds, currentPly - 1);
  const nextMove = moveOnLine(game, activeLineNodeIds, currentPly + 1);
  const currentFen =
    currentPly <= 0
      ? game.initialFen
      : (game.nodesById[activeLineNodeIds[currentPly - 1]!]?.fenAfter ??
        game.initialFen);

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
    activeLineNodeIds,
  };
}

export function goToStart(state: GameReaderState): GameReaderState {
  const branchRoot = state.activeLineNodeIds[0] ?? null;
  if (!branchRoot) {
    return createGameReaderState(state.game, 0, state.boardFlipped);
  }
  const active = buildActiveLine(state.game, branchRoot);
  const base = createGameReaderState(state.game, 0, state.boardFlipped);
  const first = state.game.nodesById[active[0]!];
  return {
    ...base,
    activeLineNodeIds: active,
    totalPly: active.length,
    canGoForward: active.length > 0,
    nextMove: first
      ? {
          ply: 1,
          moveNumber: first.moveNumber,
          color: first.color,
          san: first.san,
          fenBefore: first.fenBefore,
          fenAfter: first.fenAfter,
          from: first.from,
          to: first.to,
          promotion: first.promotion,
          comment: first.comment,
          nags: first.nags,
          hasVariations: first.childIds.length > 1 || undefined,
          nodeId: first.id,
        }
      : null,
  };
}

export function goToEnd(state: GameReaderState): GameReaderState {
  const line =
    state.activeLineNodeIds.length > 0
      ? state.activeLineNodeIds
      : buildActiveLine(state.game, null);
  const lastId = line[line.length - 1] ?? null;
  if (lastId) {
    return createGameReaderState(state.game, lastId, state.boardFlipped);
  }
  return createGameReaderState(state.game, 0, state.boardFlipped);
}

export function goToPrevious(state: GameReaderState): GameReaderState {
  const line = state.activeLineNodeIds;
  const nextPly = Math.max(0, state.currentPly - 1);
  if (nextPly === 0) {
    // Stay on same branch context by remembering branch root via line[0].
    const branchRoot = line[0] ?? null;
    const rebuilt = createGameReaderState(state.game, 0, state.boardFlipped);
    if (branchRoot) {
      return {
        ...rebuilt,
        activeLineNodeIds: buildActiveLine(state.game, branchRoot),
        totalPly: buildActiveLine(state.game, branchRoot).length,
        canGoForward: buildActiveLine(state.game, branchRoot).length > 0,
      };
    }
    return rebuilt;
  }
  const nodeId = line[nextPly - 1]!;
  return createGameReaderState(state.game, nodeId, state.boardFlipped);
}

export function goToNext(state: GameReaderState): GameReaderState {
  const line = state.activeLineNodeIds;
  if (state.currentPly >= line.length) return state;
  const nodeId = line[state.currentPly]!;
  return createGameReaderState(state.game, nodeId, state.boardFlipped);
}

export function goToPly(state: GameReaderState, ply: number): GameReaderState {
  const line = state.activeLineNodeIds;
  const safe = clampReaderPly(state.game, ply, line.length);
  if (safe === 0) {
    const branchRoot = line[0] ?? null;
    const rebuilt = createGameReaderState(state.game, 0, state.boardFlipped);
    if (!branchRoot) return rebuilt;
    const active = buildActiveLine(state.game, branchRoot);
    return {
      ...rebuilt,
      activeLineNodeIds: active,
      totalPly: active.length,
      canGoForward: active.length > 0,
    };
  }
  return createGameReaderState(state.game, line[safe - 1]!, state.boardFlipped);
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
