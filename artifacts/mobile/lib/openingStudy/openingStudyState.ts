/**
 * Pedagogical opening reader — branch-aware navigation on a ReaderGame.
 * Independent from the general Partie/Analyse workspace.
 */
import type { ReaderGame, ReaderNode } from '../gameReader/types.ts';

export type StudyBranchChoice = {
  nodeId: string;
  san: string;
  nags: string[];
  isMain: boolean;
  commentPreview?: string;
};

export type OpeningStudyState = {
  game: ReaderGame;
  currentNodeId: string | null;
  activeLineNodeIds: string[];
  pendingChoices: StudyBranchChoice[] | null;
  exploringSans: string[] | null;
  exploringFen: string | null;
  exploringStartFen: string | null;
  courseAnchorNodeId: string | null;
};

export function createOpeningStudyState(game: ReaderGame): OpeningStudyState {
  const roots = choicesFromIds(game, game.rootIds);
  return {
    game,
    currentNodeId: null,
    activeLineNodeIds: [],
    pendingChoices: roots.length > 1 ? roots : null,
    exploringSans: null,
    exploringFen: null,
    exploringStartFen: null,
    courseAnchorNodeId: null,
  };
}

function choicesFromIds(game: ReaderGame, ids: string[]): StudyBranchChoice[] {
  return ids.map((id, i) => {
    const node = game.nodesById[id]!;
    return {
      nodeId: id,
      san: node.san,
      nags: node.nags ?? [],
      isMain: i === 0,
      commentPreview: node.commentBefore || node.comment,
    };
  });
}

export function currentStudyNode(state: OpeningStudyState): ReaderNode | null {
  if (!state.currentNodeId) return null;
  return state.game.nodesById[state.currentNodeId] ?? null;
}

export function commentsForCurrentPosition(state: OpeningStudyState): {
  before: string;
  after: string;
} {
  if (state.exploringSans) {
    return { before: '', after: '' };
  }
  if (!state.currentNodeId) {
    const roots = state.game.rootIds
      .map((id) => state.game.nodesById[id])
      .filter(Boolean);
    const befores = roots
      .map((n) => n!.commentBefore?.trim() ?? '')
      .filter(Boolean);
    return { before: uniqueJoin(befores), after: '' };
  }
  const node = state.game.nodesById[state.currentNodeId];
  return {
    before: node?.commentBefore?.trim() ?? '',
    after: node?.comment?.trim() ?? '',
  };
}

export function combinedCommentText(state: OpeningStudyState): string {
  const { before, after } = commentsForCurrentPosition(state);
  return [before, after].filter(Boolean).join('\n\n');
}

export function currentStudyFen(state: OpeningStudyState): string {
  if (state.exploringFen) return state.exploringFen;
  if (!state.currentNodeId) return state.game.initialFen;
  return state.game.nodesById[state.currentNodeId]?.fenAfter ?? state.game.initialFen;
}

export function studyCommentFens(state: OpeningStudyState): string[] {
  const fens = [currentStudyFen(state)];
  const node = currentStudyNode(state);
  if (node?.fenBefore && node.fenBefore !== fens[0]) fens.push(node.fenBefore);
  return fens;
}

export function explorationStartFen(state: OpeningStudyState): string {
  if (state.courseAnchorNodeId) {
    return (
      state.game.nodesById[state.courseAnchorNodeId]?.fenAfter ??
      state.game.initialFen
    );
  }
  return state.game.initialFen;
}

export function studyCanGoBack(state: OpeningStudyState): boolean {
  return Boolean(state.exploringSans) || Boolean(state.currentNodeId);
}

export function studyCanGoForward(state: OpeningStudyState): boolean {
  if (state.exploringSans) return false;
  if (state.pendingChoices && state.pendingChoices.length > 1) return false;
  const children = state.currentNodeId
    ? state.game.nodesById[state.currentNodeId]?.childIds ?? []
    : state.game.rootIds;
  return children.length === 1;
}

export function lineSansToLeaf(state: OpeningStudyState): string[] {
  const sans = activeLineSans(state);
  if (state.exploringSans) return sans;
  let node = state.currentNodeId
    ? state.game.nodesById[state.currentNodeId]
    : undefined;
  if (!node && state.game.rootIds.length === 1) {
    node = state.game.nodesById[state.game.rootIds[0]!];
    if (node && !sans.includes(node.san)) sans.push(node.san);
  }
  while (node?.childIds[0]) {
    const next = state.game.nodesById[node.childIds[0]];
    if (!next) break;
    if (!state.activeLineNodeIds.includes(next.id)) sans.push(next.san);
    node = next;
  }
  return sans;
}

function uniqueJoin(parts: string[]): string {
  return [...new Set(parts)].join('\n\n');
}

function lineTo(game: ReaderGame, nodeId: string | null): string[] {
  if (!nodeId) return [];
  const ids: string[] = [];
  let id: string | null = nodeId;
  while (id) {
    ids.unshift(id);
    id = game.nodesById[id]?.parentId ?? null;
  }
  return ids;
}

export function selectStudyBranch(
  state: OpeningStudyState,
  nodeId: string,
): OpeningStudyState {
  const node = state.game.nodesById[nodeId];
  if (!node) return state;
  const activeLineNodeIds = lineTo(state.game, nodeId);
  const childChoices = choicesFromIds(state.game, node.childIds);
  return {
    ...state,
    currentNodeId: nodeId,
    activeLineNodeIds,
    pendingChoices: childChoices.length > 1 ? childChoices : null,
    exploringSans: null,
    exploringFen: null,
    exploringStartFen: null,
  };
}

export function studyGoStart(state: OpeningStudyState): OpeningStudyState {
  const roots = choicesFromIds(state.game, state.game.rootIds);
  return {
    ...state,
    currentNodeId: null,
    activeLineNodeIds: [],
    pendingChoices: roots.length > 1 ? roots : null,
    exploringSans: null,
    exploringFen: null,
    exploringStartFen: null,
  };
}

export function studyGoPrev(state: OpeningStudyState): OpeningStudyState {
  if (state.exploringSans) {
    return {
      ...state,
      exploringSans: null,
      exploringFen: null,
      exploringStartFen: null,
    };
  }
  const node = currentStudyNode(state);
  if (!node) return state;
  if (!node.parentId) return studyGoStart(state);
  return selectStudyBranch(state, node.parentId);
}

export function studyGoNext(state: OpeningStudyState): OpeningStudyState {
  if (state.pendingChoices && state.pendingChoices.length > 1) return state;
  if (state.exploringSans) return state;
  const children = state.currentNodeId
    ? state.game.nodesById[state.currentNodeId]?.childIds ?? []
    : state.game.rootIds;
  if (children.length === 0) return state;
  if (children.length === 1) return selectStudyBranch(state, children[0]!);
  return {
    ...state,
    pendingChoices: choicesFromIds(state.game, children),
  };
}

export function studyGoEnd(state: OpeningStudyState): OpeningStudyState {
  let next: OpeningStudyState = {
    ...state,
    exploringSans: null,
    exploringFen: null,
    exploringStartFen: null,
  };
  if (next.pendingChoices && next.pendingChoices.length > 1) return next;
  while (true) {
    const children = next.currentNodeId
      ? next.game.nodesById[next.currentNodeId]?.childIds ?? []
      : next.game.rootIds;
    if (children.length === 0) return next;
    if (children.length > 1) {
      return {
        ...next,
        pendingChoices: choicesFromIds(next.game, children),
      };
    }
    next = selectStudyBranch(next, children[0]!);
  }
}

export function beginCommentExploration(
  state: OpeningStudyState,
  sans: string[],
  fenAfter: string,
  startFen: string,
): OpeningStudyState {
  return {
    ...state,
    exploringSans: sans,
    exploringFen: fenAfter,
    exploringStartFen: startFen,
    courseAnchorNodeId: state.currentNodeId,
  };
}

export function returnToCourse(state: OpeningStudyState): OpeningStudyState {
  const anchor = state.courseAnchorNodeId;
  const cleared = {
    ...state,
    exploringSans: null,
    exploringFen: null,
    exploringStartFen: null,
    courseAnchorNodeId: null,
  };
  if (anchor) return selectStudyBranch(cleared, anchor);
  return studyGoStart(cleared);
}

export function activeLineSans(state: OpeningStudyState): string[] {
  return state.activeLineNodeIds.map((id) => state.game.nodesById[id]!.san);
}
