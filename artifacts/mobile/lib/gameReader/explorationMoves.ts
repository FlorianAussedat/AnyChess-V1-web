/**
 * Manual exploration on the reader tree (Analyseur / Lecteur board moves).
 *
 * Origin lifecycle (`explorationOriginNodeId`):
 * - `null` — no exploration origin yet (non-exploration context).
 * - `''` — origin is the game start position (before any move).
 * - node id — origin is that tree node.
 *
 * - First manual move from a non-exploration context sets the origin to the
 *   cursor *before* that move (`''` when at start).
 * - Further exploration moves keep the same origin.
 * - `returnToExplorationOrigin` navigates back without deleting variations and
 *   does **not** clear the origin.
 * - Origin is cleared/reset only when starting a **new** exploration after
 *   return (manual move while already sitting on the origin).
 */
import { Chess } from 'chess.js';
import {
  buildActiveLine,
  stateFromActiveLine,
} from './gameReaderState.ts';
import type {
  GameReaderState,
  ReaderColor,
  ReaderGame,
  ReaderNode,
} from './types.ts';

/** Sentinel: exploration started from the initial position (ply 0). */
export const EXPLORATION_ORIGIN_START = '';

function sideFromFen(fen: string): ReaderColor {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

function createExplorationNodeId(): string {
  return `x_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function siblingIdsAtCursor(game: ReaderGame, parentId: string | null): string[] {
  if (!parentId) return [...game.rootIds];
  return [...(game.nodesById[parentId]?.childIds ?? [])];
}

function nodeMatchesMove(
  node: ReaderNode,
  from: string,
  to: string,
  promotion: string | undefined,
  san: string,
): boolean {
  if (node.san === san) return true;
  if (node.from === from && node.to === to) {
    const nodePromo = (node.promotion ?? '').toLowerCase();
    const wantPromo = (promotion ?? '').toLowerCase();
    return nodePromo === wantPromo;
  }
  return false;
}

function cursorToOriginKey(currentNodeId: string | null): string {
  return currentNodeId ?? EXPLORATION_ORIGIN_START;
}

function originKeyToNodeId(origin: string): string | null {
  return origin === EXPLORATION_ORIGIN_START ? null : origin;
}

function isAtExplorationOrigin(state: GameReaderState): boolean {
  const origin = state.explorationOriginNodeId;
  if (origin == null) return false;
  return cursorToOriginKey(state.currentNodeId) === origin;
}

/**
 * Play a legal board move on the reader tree.
 * Prefers an existing continuation with the same SAN/UCI; otherwise appends an
 * exploration child without replacing the main line.
 */
export function playMoveOnReader(
  state: GameReaderState,
  from: string,
  to: string,
  promotion?: string,
): GameReaderState {
  let chess: Chess;
  try {
    chess = new Chess(state.currentFen);
  } catch {
    return state;
  }

  let played;
  try {
    played = chess.move({
      from: from as never,
      to: to as never,
      promotion: promotion as never,
    });
  } catch {
    return state;
  }
  if (!played) return state;

  const parentId = state.currentNodeId;
  const siblings = siblingIdsAtCursor(state.game, parentId);
  const existingId = siblings.find((id) => {
    const node = state.game.nodesById[id];
    return (
      node != null &&
      nodeMatchesMove(node, played.from, played.to, played.promotion, played.san)
    );
  });

  let nextOrigin = state.explorationOriginNodeId;
  if (state.explorationOriginNodeId == null) {
    // First digression from non-exploration context.
    nextOrigin = cursorToOriginKey(state.currentNodeId);
  } else if (isAtExplorationOrigin(state)) {
    // New exploration after return — reset origin to this cursor.
    nextOrigin = cursorToOriginKey(state.currentNodeId);
  }

  if (existingId) {
    const activeLineNodeIds = buildActiveLine(state.game, existingId);
    const ply = activeLineNodeIds.indexOf(existingId) + 1;
    return stateFromActiveLine(
      state.game,
      activeLineNodeIds,
      ply,
      state.boardFlipped,
      nextOrigin,
    );
  }

  const fenBefore = state.currentFen;
  const fenAfter = chess.fen();
  const parentNode = parentId ? state.game.nodesById[parentId] : null;
  const variationIndex = siblings.length;
  const depth = parentNode
    ? variationIndex === 0
      ? parentNode.depth
      : parentNode.depth + 1
    : variationIndex === 0
      ? 0
      : 1;
  const fullMove = Number(fenBefore.split(' ')[5] ?? '1');
  const id = createExplorationNodeId();

  const node: ReaderNode = {
    id,
    san: played.san,
    fenBefore,
    fenAfter,
    from: played.from,
    to: played.to,
    promotion: played.promotion,
    moveNumber: fullMove,
    color: sideFromFen(fenBefore),
    parentId,
    childIds: [],
    variationIndex,
    depth,
  };

  const nodesById = { ...state.game.nodesById, [id]: node };
  let rootIds = state.game.rootIds;
  if (!parentId) {
    rootIds = [...state.game.rootIds, id];
  } else if (parentNode) {
    nodesById[parentId] = {
      ...parentNode,
      childIds: [...parentNode.childIds, id],
    };
  }

  const game: ReaderGame = {
    ...state.game,
    nodesById,
    rootIds,
    hasVariations: state.game.hasVariations || variationIndex > 0,
    // Main-line `moves` projection stays intact — exploration never replaces it.
  };

  const activeLineNodeIds = buildActiveLine(game, id);
  const ply = activeLineNodeIds.indexOf(id) + 1;
  return stateFromActiveLine(
    game,
    activeLineNodeIds,
    ply,
    state.boardFlipped,
    nextOrigin,
  );
}

/** Navigate back to the exploration origin without deleting variations. */
export function returnToExplorationOrigin(
  state: GameReaderState,
): GameReaderState {
  const origin = state.explorationOriginNodeId;
  if (origin == null) return state;

  const originNodeId = originKeyToNodeId(origin);
  if (originNodeId != null && !state.game.nodesById[originNodeId]) {
    return state;
  }

  if (originNodeId == null) {
    return stateFromActiveLine(
      state.game,
      state.activeLineNodeIds,
      0,
      state.boardFlipped,
      origin,
    );
  }

  const activeLineNodeIds = buildActiveLine(state.game, originNodeId);
  const ply = activeLineNodeIds.indexOf(originNodeId) + 1;
  return stateFromActiveLine(
    state.game,
    activeLineNodeIds,
    Math.max(0, ply),
    state.boardFlipped,
    origin,
  );
}
