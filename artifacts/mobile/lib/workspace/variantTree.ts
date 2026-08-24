/**
 * Immutable variant tree for the universal chess workspace.
 * Mainline is never deleted; siblings and sub-variants are preserved.
 */
import { Chess, type Move } from 'chess.js';
import type {
  AnalysisMarker,
  ChessWorkspacePayload,
  EngineEvaluation,
  WorkspaceMove,
  WorkspaceNode,
} from './types.ts';

export type VariantChoice = {
  nodeId: string;
  san: string;
  isMainline: boolean;
  label: 'mainline' | 'variant1' | 'variant2' | 'variant';
  variantIndex: number | null;
};

export type VariantTree = {
  nodesById: Record<string, WorkspaceNode>;
  rootNodeId: string;
  currentNodeId: string;
  mainlineNodeIds: string[];
  activePathNodeIds: string[];
  divergenceNodeId: string | null;
  nextVariantSeq: number;
  preferredChildByParentId: Record<string, string>;
};

export const STANDARD_START_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function sideFromFen(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

export function uciFromMove(move: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function cloneNode(node: WorkspaceNode): WorkspaceNode {
  return {
    ...node,
    childrenIds: [...node.childrenIds],
    markerIds: node.markerIds ? [...node.markerIds] : undefined,
    moveFromParent: node.moveFromParent ? { ...node.moveFromParent } : undefined,
    evaluation: node.evaluation ? { ...node.evaluation } : undefined,
  };
}

function cloneTree(tree: VariantTree): VariantTree {
  const nodesById: Record<string, WorkspaceNode> = {};
  for (const [id, node] of Object.entries(tree.nodesById)) {
    nodesById[id] = cloneNode(node);
  }
  return {
    nodesById,
    rootNodeId: tree.rootNodeId,
    currentNodeId: tree.currentNodeId,
    mainlineNodeIds: [...tree.mainlineNodeIds],
    activePathNodeIds: [...tree.activePathNodeIds],
    divergenceNodeId: tree.divergenceNodeId,
    nextVariantSeq: tree.nextVariantSeq,
    preferredChildByParentId: { ...tree.preferredChildByParentId },
  };
}

function pathToRoot(nodesById: Record<string, WorkspaceNode>, nodeId: string): string[] {
  const path: string[] = [];
  let current: string | null = nodeId;
  const guard = new Set<string>();
  while (current && !guard.has(current)) {
    guard.add(current);
    path.push(current);
    current = nodesById[current]?.parentId ?? null;
  }
  path.reverse();
  return path;
}

function firstNonMainlineId(nodesById: Record<string, WorkspaceNode>, path: string[]): string | null {
  for (const id of path) {
    const node = nodesById[id];
    if (node && !node.isMainline) return id;
  }
  return null;
}

function recomputeDerived(tree: VariantTree): VariantTree {
  const activePathNodeIds = pathToRoot(tree.nodesById, tree.currentNodeId);
  const firstVariantId = firstNonMainlineId(tree.nodesById, activePathNodeIds);
  const divergenceNodeId = firstVariantId
    ? (tree.nodesById[firstVariantId]?.parentId ?? null)
    : null;
  return { ...tree, activePathNodeIds, divergenceNodeId };
}

function mutateNode(
  tree: VariantTree,
  nodeId: string,
  patch: (node: WorkspaceNode) => void,
): void {
  const existing = tree.nodesById[nodeId];
  if (!existing) return;
  const next = cloneNode(existing);
  patch(next);
  tree.nodesById[nodeId] = next;
}

function tryMove(fen: string, san: string): Move | null {
  try {
    const chess = new Chess(fen);
    const played = chess.move(san);
    return played ?? null;
  } catch {
    return null;
  }
}

function tryUci(fen: string, from: string, to: string, promotion?: string): Move | null {
  try {
    const chess = new Chess(fen);
    const played = chess.move({
      from,
      to,
      promotion: (promotion as 'q' | 'r' | 'b' | 'n' | undefined) ?? undefined,
    });
    return played ?? null;
  } catch {
    return null;
  }
}

function assertLegalFen(fen: string): string {
  const chess = new Chess(fen);
  return chess.fen();
}

export function createTreeFromPayload(payload: ChessWorkspacePayload): VariantTree {
  const initialFen = assertLegalFen(payload.initialFen);
  const rootId = 'root';
  const root: WorkspaceNode = {
    id: rootId,
    parentId: null,
    childrenIds: [],
    fen: initialFen,
    ply: 0,
    isMainline: true,
    mainlineIndex: 0,
  };

  const evalByPly = new Map<number, EngineEvaluation>();
  for (const entry of payload.evaluations ?? []) {
    evalByPly.set(entry.ply, entry.evaluation);
  }
  const markersByPly = new Map<number, string[]>();
  for (const marker of payload.markers ?? []) {
    const list = markersByPly.get(marker.ply) ?? [];
    list.push(marker.id);
    markersByPly.set(marker.ply, list);
  }
  if (evalByPly.has(0)) root.evaluation = evalByPly.get(0);
  if (markersByPly.has(0)) root.markerIds = markersByPly.get(0);

  const nodesById: Record<string, WorkspaceNode> = { [rootId]: root };
  const mainlineNodeIds = [rootId];
  const preferredChildByParentId: Record<string, string> = {};

  let parentId = rootId;
  let parentFen = initialFen;
  const moves = payload.moves ?? [];
  for (let i = 0; i < moves.length; i += 1) {
    const move = moves[i]!;
    const played = tryMove(parentFen, move.san);
    if (!played) {
      throw new Error(`Illegal mainline move "${move.san}" at ply ${move.ply}.`);
    }
    const chess = new Chess(parentFen);
    chess.move(played);
    const fenAfter = chess.fen();
    const nodeId = `main-${i + 1}`;
    const node: WorkspaceNode = {
      id: nodeId,
      parentId,
      childrenIds: [],
      fen: fenAfter,
      ply: i + 1,
      moveFromParent: {
        san: played.san,
        uci: uciFromMove(played),
        playedBy: sideFromFen(parentFen),
      },
      evaluation: evalByPly.get(i + 1) ?? move.evaluationAfter,
      markerIds: markersByPly.get(i + 1),
      isMainline: true,
      mainlineIndex: i + 1,
    };
    nodesById[nodeId] = node;
    nodesById[parentId]!.childrenIds.push(nodeId);
    preferredChildByParentId[parentId] = nodeId;
    mainlineNodeIds.push(nodeId);
    parentId = nodeId;
    parentFen = fenAfter;
  }

  return recomputeDerived({
    nodesById,
    rootNodeId: rootId,
    currentNodeId: rootId,
    mainlineNodeIds,
    activePathNodeIds: [rootId],
    divergenceNodeId: null,
    nextVariantSeq: 1,
    preferredChildByParentId,
  });
}

export function createTreeFromFen(fen: string): VariantTree {
  return createTreeFromPayload({
    schemaVersion: 1,
    workspaceMode: 'free-play',
    source: 'manual-fen',
    title: 'FEN',
    initialFen: fen,
    orientation: sideFromFen(fen),
    moves: [],
  });
}

export function currentNode(tree: VariantTree): WorkspaceNode {
  return tree.nodesById[tree.currentNodeId]!;
}

export function nodeById(tree: VariantTree, id: string): WorkspaceNode | null {
  return tree.nodesById[id] ?? null;
}

export function activePathMoves(tree: VariantTree): WorkspaceMove[] {
  const moves: WorkspaceMove[] = [];
  const path = tree.activePathNodeIds;
  for (let i = 1; i < path.length; i += 1) {
    const node = tree.nodesById[path[i]!]!;
    const parent = tree.nodesById[path[i - 1]!]!;
    if (!node.moveFromParent) continue;
    moves.push({
      ply: node.ply,
      san: node.moveFromParent.san,
      uci: node.moveFromParent.uci,
      fenBefore: parent.fen,
      fenAfter: node.fen,
      playedBy: node.moveFromParent.playedBy,
      evaluationAfter: node.evaluation,
    });
  }
  return moves;
}

export function mainlineMoves(tree: VariantTree): WorkspaceMove[] {
  const moves: WorkspaceMove[] = [];
  for (let i = 1; i < tree.mainlineNodeIds.length; i += 1) {
    const node = tree.nodesById[tree.mainlineNodeIds[i]!]!;
    const parent = tree.nodesById[tree.mainlineNodeIds[i - 1]!]!;
    if (!node.moveFromParent) continue;
    moves.push({
      ply: node.ply,
      san: node.moveFromParent.san,
      uci: node.moveFromParent.uci,
      fenBefore: parent.fen,
      fenAfter: node.fen,
      playedBy: node.moveFromParent.playedBy,
      evaluationAfter: node.evaluation,
    });
  }
  return moves;
}

export function childChoices(tree: VariantTree, parentId = tree.currentNodeId): VariantChoice[] {
  const parent = tree.nodesById[parentId];
  if (!parent) return [];
  let variantIndex = 0;
  return parent.childrenIds.map((id) => {
    const child = tree.nodesById[id]!;
    const san = child.moveFromParent?.san ?? '';
    if (child.isMainline) {
      return { nodeId: id, san, isMainline: true, label: 'mainline' as const, variantIndex: null };
    }
    variantIndex += 1;
    const label =
      variantIndex === 1 ? 'variant1' : variantIndex === 2 ? 'variant2' : 'variant';
    return { nodeId: id, san, isMainline: false, label, variantIndex };
  });
}

function attachChild(tree: VariantTree, parentId: string, played: Move, isMainline: boolean): string {
  const parent = tree.nodesById[parentId]!;
  const chess = new Chess(parent.fen);
  chess.move(played);
  const fenAfter = chess.fen();
  const existing = parent.childrenIds.find((id) => {
    const child = tree.nodesById[id];
    return child?.moveFromParent?.san === played.san;
  });
  if (existing) {
    tree.preferredChildByParentId[parentId] = existing;
    tree.currentNodeId = existing;
    return existing;
  }

  const id = isMainline
    ? `main-${parent.ply + 1}`
    : `var-${tree.nextVariantSeq++}`;
  const node: WorkspaceNode = {
    id,
    parentId,
    childrenIds: [],
    fen: fenAfter,
    ply: parent.ply + 1,
    moveFromParent: {
      san: played.san,
      uci: uciFromMove(played),
      playedBy: sideFromFen(parent.fen),
    },
    isMainline,
    mainlineIndex: isMainline ? parent.ply + 1 : undefined,
  };
  tree.nodesById[id] = node;
  mutateNode(tree, parentId, (p) => {
    p.childrenIds.push(id);
  });
  if (isMainline) {
    tree.mainlineNodeIds.push(id);
  }
  tree.preferredChildByParentId[parentId] = id;
  tree.currentNodeId = id;
  return id;
}

function playParsedMove(tree: VariantTree, played: Move): VariantTree {
  const next = cloneTree(tree);
  const parent = next.nodesById[next.currentNodeId]!;
  const expectedMain = parent.childrenIds
    .map((id) => next.nodesById[id])
    .find((child) => child?.isMainline);
  const isMainlineContinuation =
    parent.isMainline &&
    (expectedMain
      ? expectedMain.moveFromParent?.san === played.san
      : true);
  attachChild(next, parent.id, played, Boolean(isMainlineContinuation));
  return recomputeDerived(next);
}

export function playSan(tree: VariantTree, san: string): VariantTree | null {
  const played = tryMove(currentNode(tree).fen, san);
  if (!played) return null;
  return playParsedMove(tree, played);
}

export function playUci(
  tree: VariantTree,
  from: string,
  to: string,
  promotion?: string,
): VariantTree | null {
  const played = tryUci(currentNode(tree).fen, from, to, promotion);
  if (!played) return null;
  return playParsedMove(tree, played);
}

export function selectNode(tree: VariantTree, nodeId: string): VariantTree | null {
  if (!tree.nodesById[nodeId]) return null;
  const next = cloneTree(tree);
  next.currentNodeId = nodeId;
  const parentId = next.nodesById[nodeId]?.parentId;
  if (parentId) next.preferredChildByParentId[parentId] = nodeId;
  return recomputeDerived(next);
}

export function goPrev(tree: VariantTree): VariantTree {
  const parentId = currentNode(tree).parentId;
  if (!parentId) return tree;
  return selectNode(tree, parentId) ?? tree;
}

export function goNext(tree: VariantTree): VariantTree {
  const node = currentNode(tree);
  if (node.childrenIds.length === 0) return tree;
  const preferred = tree.preferredChildByParentId[node.id];
  const mainChild = node.childrenIds.find((id) => tree.nodesById[id]?.isMainline);
  const target = (preferred && node.childrenIds.includes(preferred) ? preferred : null)
    ?? mainChild
    ?? node.childrenIds[0]!;
  return selectNode(tree, target) ?? tree;
}

export function goStart(tree: VariantTree): VariantTree {
  return selectNode(tree, tree.rootNodeId) ?? tree;
}

export function goEnd(tree: VariantTree): VariantTree {
  let next = tree;
  for (let i = 0; i < 512; i += 1) {
    const stepped = goNext(next);
    if (stepped.currentNodeId === next.currentNodeId) return stepped;
    next = stepped;
  }
  return next;
}

export function jumpToMainlinePly(tree: VariantTree, ply: number): VariantTree {
  const clamped = Math.max(0, Math.min(tree.mainlineNodeIds.length - 1, ply));
  const id = tree.mainlineNodeIds[clamped]!;
  return selectNode(tree, id) ?? tree;
}

export function jumpToActivePly(tree: VariantTree, ply: number): VariantTree {
  const clamped = Math.max(0, Math.min(tree.activePathNodeIds.length - 1, ply));
  const id = tree.activePathNodeIds[clamped]!;
  return selectNode(tree, id) ?? tree;
}

/**
 * Return to the exact mainline node where the active branch diverged,
 * restore the mainline continuation as the preferred child, keep variants.
 */
export function returnToDivergence(tree: VariantTree): VariantTree {
  if (!tree.divergenceNodeId) return tree;
  const next = cloneTree(tree);
  const divergenceId = next.divergenceNodeId!;
  const divergence = next.nodesById[divergenceId];
  if (!divergence) return tree;
  const mainChild = divergence.childrenIds.find((id) => next.nodesById[id]?.isMainline);
  if (mainChild) next.preferredChildByParentId[divergenceId] = mainChild;
  next.currentNodeId = divergenceId;
  return recomputeDerived(next);
}

export function setNodeEvaluation(
  tree: VariantTree,
  nodeId: string,
  evaluation: EngineEvaluation,
): VariantTree {
  if (!tree.nodesById[nodeId]) return tree;
  const next = cloneTree(tree);
  mutateNode(next, nodeId, (node) => {
    node.evaluation = preferEvaluation(node.evaluation ?? null, evaluation);
  });
  return next;
}

export function preferEvaluation(
  current: EngineEvaluation | null,
  incoming: EngineEvaluation,
): EngineEvaluation {
  if (!current) return incoming;
  const currentDepth = current.depth ?? 0;
  const incomingDepth = incoming.depth ?? 0;
  return incomingDepth >= currentDepth ? incoming : current;
}

export function legalDestinations(fen: string, from: string): string[] {
  try {
    return new Chess(fen)
      .moves({ square: from as never, verbose: true })
      .map((move) => move.to);
  } catch {
    return [];
  }
}

export function lastMoveOnPath(tree: VariantTree): { from: string; to: string } | null {
  const node = currentNode(tree);
  const uci = node.moveFromParent?.uci;
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

export function markersForCurrentNode(
  tree: VariantTree,
  markers: readonly AnalysisMarker[] | undefined,
): AnalysisMarker[] {
  if (!markers?.length) return [];
  const ply = currentNode(tree).ply;
  return markers.filter((marker) => marker.ply === ply);
}

export function mainlineSans(tree: VariantTree): string[] {
  return mainlineMoves(tree).map((move) => move.san);
}

export function isOnMainline(tree: VariantTree): boolean {
  return currentNode(tree).isMainline && tree.divergenceNodeId == null;
}
