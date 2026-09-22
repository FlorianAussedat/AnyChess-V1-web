/**
 * Visual opening PGN editor — mutate a ReaderGame tree, never raw PGN text.
 */
import { Chess } from 'chess.js';
import type { Move } from 'chess.js';
import {
  emptyReaderGame,
  parseReaderPgn,
  STANDARD_START_FEN,
  type ReaderGame,
  type ReaderMove,
  type ReaderNode,
} from '../gameReader/index.ts';
import { parsePgn } from '../repertoire/pgnParser.ts';
import { serializeOpeningPgn } from './serializeOpeningPgn.ts';
import {
  createOpeningStudyState,
  studyGoEnd,
  studyGoNext,
  studyGoPrev,
  studyGoStart,
} from './openingStudyState.ts';

export type OpeningEditorSnapshot = {
  headers: Record<string, string>;
  game: ReaderGame;
  currentNodeId: string | null;
  displayName: string;
};

export type OpeningEditorSession = {
  snapshot: OpeningEditorSnapshot;
  past: OpeningEditorSnapshot[];
  future: OpeningEditorSnapshot[];
  dirty: boolean;
  fileId: string | null;
  folderId: string;
  baselinePgn: string;
  baselineName: string;
};

export type PlayEditorMoveResult =
  | { kind: 'follow'; session: OpeningEditorSession }
  | { kind: 'added'; session: OpeningEditorSession }
  | { kind: 'confirm-variation'; san: string; move: Move };

const MAX_HISTORY = 40;

export function cloneSnapshot(snap: OpeningEditorSnapshot): OpeningEditorSnapshot {
  return JSON.parse(JSON.stringify(snap)) as OpeningEditorSnapshot;
}

export function defaultOpeningHeaders(): Record<string, string> {
  return {
    Event: 'AnyChess Opening Study',
    Site: 'AnyChess',
    Result: '*',
  };
}

function withDirty(session: OpeningEditorSession): OpeningEditorSession {
  const pgn = serializeOpeningPgn(session.snapshot.headers, session.snapshot.game);
  return {
    ...session,
    dirty:
      pgn !== session.baselinePgn ||
      session.snapshot.displayName !== session.baselineName,
  };
}

export function editorIsDirty(session: OpeningEditorSession): boolean {
  return withDirty(session).dirty;
}

export function createEmptyEditorSession(options: {
  folderId: string;
  displayName: string;
  fileId?: string | null;
  initialFen?: string;
  extraHeaders?: Record<string, string>;
}): OpeningEditorSession {
  const game = emptyReaderGame(options.initialFen);
  const headers = { ...defaultOpeningHeaders(), ...options.extraHeaders };
  if (game.initialFen !== STANDARD_START_FEN) {
    headers.SetUp = headers.SetUp || '1';
    headers.FEN = headers.FEN || game.initialFen;
  }
  const snapshot: OpeningEditorSnapshot = {
    headers,
    game,
    currentNodeId: null,
    displayName: options.displayName,
  };
  const baselinePgn = serializeOpeningPgn(snapshot.headers, snapshot.game);
  return {
    snapshot,
    past: [],
    future: [],
    dirty: false,
    fileId: options.fileId ?? null,
    folderId: options.folderId,
    baselinePgn,
    baselineName: options.displayName,
  };
}

export function loadEditorSessionFromPgn(options: {
  pgnText: string;
  folderId: string;
  displayName: string;
  fileId?: string | null;
  focusNodeId?: string | null;
}): OpeningEditorSession {
  let headers = defaultOpeningHeaders();
  try {
    const games = parsePgn(options.pgnText);
    headers = { ...headers, ...(games[0]?.headers ?? {}) };
  } catch {
    // Keep default headers when the raw text is not yet a complete PGN.
  }
  const parsed = parseReaderPgn(options.pgnText, {
    allowEmptyMoves: true,
    rawPgn: options.pgnText,
  });
  const game = parsed.ok ? parsed.game : emptyReaderGame();
  let currentNodeId = options.focusNodeId ?? null;
  if (currentNodeId && !game.nodesById[currentNodeId]) currentNodeId = null;
  const snapshot: OpeningEditorSnapshot = {
    headers,
    game,
    currentNodeId,
    displayName: options.displayName,
  };
  return {
    snapshot,
    past: [],
    future: [],
    dirty: false,
    fileId: options.fileId ?? null,
    folderId: options.folderId,
    baselinePgn: serializeOpeningPgn(snapshot.headers, snapshot.game),
    baselineName: options.displayName,
  };
}

export function editorExportPgn(session: OpeningEditorSession): string {
  return serializeOpeningPgn(session.snapshot.headers, session.snapshot.game);
}

export function editorCurrentFen(session: OpeningEditorSession): string {
  const { game, currentNodeId } = session.snapshot;
  if (!currentNodeId) return game.initialFen || STANDARD_START_FEN;
  return game.nodesById[currentNodeId]?.fenAfter ?? game.initialFen;
}

export function editorChildIds(session: OpeningEditorSession): string[] {
  const { game, currentNodeId } = session.snapshot;
  if (!currentNodeId) return game.rootIds;
  return game.nodesById[currentNodeId]?.childIds ?? [];
}

export function editorCurrentNode(session: OpeningEditorSession): ReaderNode | null {
  const id = session.snapshot.currentNodeId;
  if (!id) return null;
  return session.snapshot.game.nodesById[id] ?? null;
}

function commit(
  session: OpeningEditorSession,
  next: OpeningEditorSnapshot,
): OpeningEditorSession {
  return {
    ...session,
    past: [...session.past, cloneSnapshot(session.snapshot)].slice(-MAX_HISTORY),
    future: [],
    snapshot: next,
    dirty: true,
  };
}

export function editorCanUndo(session: OpeningEditorSession): boolean {
  return session.past.length > 0;
}

export function editorCanRedo(session: OpeningEditorSession): boolean {
  return session.future.length > 0;
}

export function editorUndo(session: OpeningEditorSession): OpeningEditorSession {
  if (session.past.length === 0) return session;
  const past = [...session.past];
  const prev = past.pop()!;
  return withDirty({
    ...session,
    snapshot: prev,
    past,
    future: [cloneSnapshot(session.snapshot), ...session.future],
  });
}

export function editorRedo(session: OpeningEditorSession): OpeningEditorSession {
  if (session.future.length === 0) return session;
  const [next, ...rest] = session.future;
  return withDirty({
    ...session,
    snapshot: next!,
    past: [...session.past, cloneSnapshot(session.snapshot)],
    future: rest,
  });
}

export function editorSelectNode(
  session: OpeningEditorSession,
  nodeId: string | null,
): OpeningEditorSession {
  if (!nodeId) {
    return {
      ...session,
      snapshot: { ...session.snapshot, currentNodeId: null },
    };
  }
  if (!session.snapshot.game.nodesById[nodeId]) return session;
  return {
    ...session,
    snapshot: { ...session.snapshot, currentNodeId: nodeId },
  };
}

export function editorGoStart(session: OpeningEditorSession): OpeningEditorSession {
  const study = createOpeningStudyState(session.snapshot.game);
  const next = studyGoStart(study);
  return editorSelectNode(session, next.currentNodeId);
}

export function editorGoPrev(session: OpeningEditorSession): OpeningEditorSession {
  const study = {
    ...createOpeningStudyState(session.snapshot.game),
    currentNodeId: session.snapshot.currentNodeId,
    activeLineNodeIds: lineTo(session.snapshot.game, session.snapshot.currentNodeId),
  };
  const next = studyGoPrev(study);
  return editorSelectNode(session, next.currentNodeId);
}

export function editorGoNext(session: OpeningEditorSession): OpeningEditorSession {
  const study = {
    ...createOpeningStudyState(session.snapshot.game),
    currentNodeId: session.snapshot.currentNodeId,
    activeLineNodeIds: lineTo(session.snapshot.game, session.snapshot.currentNodeId),
  };
  const next = studyGoNext(study);
  if (next.pendingChoices && next.pendingChoices.length > 1) {
    return editorSelectNode(session, next.pendingChoices[0]!.nodeId);
  }
  return editorSelectNode(session, next.currentNodeId);
}

export function editorGoEnd(session: OpeningEditorSession): OpeningEditorSession {
  const study = {
    ...createOpeningStudyState(session.snapshot.game),
    currentNodeId: session.snapshot.currentNodeId,
    activeLineNodeIds: lineTo(session.snapshot.game, session.snapshot.currentNodeId),
  };
  const next = studyGoEnd(study);
  const id = next.currentNodeId ?? next.pendingChoices?.[0]?.nodeId ?? null;
  return editorSelectNode(session, id);
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

function newNodeId(): string {
  return `ed_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rebuildMainLine(game: ReaderGame): ReaderGame {
  const moves: ReaderMove[] = [];
  let id: string | null = game.rootIds[0] ?? null;
  let ply = 0;
  while (id) {
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    ply += 1;
    moves.push({
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
    });
    id = node.childIds[0] ?? null;
  }
  return {
    ...game,
    moves,
    hasVariations: Object.values(game.nodesById).some(
      (n) => n.variationIndex > 0 || n.childIds.length > 1,
    ) || game.rootIds.length > 1,
  };
}

function findChildBySan(game: ReaderGame, childIds: string[], san: string): ReaderNode | null {
  for (const id of childIds) {
    const node = game.nodesById[id];
    if (node && node.san === san) return node;
  }
  return null;
}

export function editorLegalDestinations(
  session: OpeningEditorSession,
  square: string,
): string[] {
  const chess = new Chess(editorCurrentFen(session));
  return chess.moves({ square: square as never, verbose: true }).map((m) => m.to);
}

export function editorTrySquareMove(
  session: OpeningEditorSession,
  from: string,
  to: string,
): PlayEditorMoveResult | null {
  const chess = new Chess(editorCurrentFen(session));
  const candidates = chess
    .moves({ square: from as never, verbose: true })
    .filter((m) => m.to === to);
  if (candidates.length === 0) return null;
  const chosen =
    candidates.find((m) => m.promotion === 'q') ?? candidates[0]!;
  const played = chess.move({
    from,
    to,
    promotion: chosen.promotion,
  });
  if (!played) return null;
  return editorPlaySan(session, played);
}

export function editorPlaySan(
  session: OpeningEditorSession,
  played: Move,
): PlayEditorMoveResult {
  const childIds = editorChildIds(session);
  const existing = findChildBySan(session.snapshot.game, childIds, played.san);
  if (existing) {
    return {
      kind: 'follow',
      session: editorSelectNode(session, existing.id),
    };
  }
  if (childIds.length > 0) {
    return { kind: 'confirm-variation', san: played.san, move: played };
  }
  return { kind: 'added', session: editorAppendMove(session, played) };
}

export function editorAppendMove(
  session: OpeningEditorSession,
  played: Move,
): OpeningEditorSession {
  const childIds = editorChildIds(session);
  const existing = findChildBySan(session.snapshot.game, childIds, played.san);
  if (existing) return editorSelectNode(session, existing.id);

  const snap = cloneSnapshot(session.snapshot);
  const fenBefore = editorCurrentFen(session);
  const parentId = snap.currentNodeId;
  const parent = parentId ? snap.game.nodesById[parentId] : null;
  const id = newNodeId();
  const variationIndex = childIds.length;
  const depth = parent
    ? variationIndex === 0
      ? parent.depth
      : parent.depth + 1
    : variationIndex === 0
      ? 0
      : 1;
  const node: ReaderNode = {
    id,
    san: played.san,
    fenBefore,
    fenAfter: '',
    from: played.from,
    to: played.to,
    promotion: played.promotion,
    moveNumber: Number(fenBefore.split(' ')[5] ?? '1'),
    color: fenBefore.split(' ')[1] === 'b' ? 'black' : 'white',
    parentId,
    childIds: [],
    variationIndex,
    depth,
  };
  const probe = new Chess(fenBefore);
  probe.move(played.san);
  node.fenAfter = probe.fen();

  snap.game.nodesById[id] = node;
  if (parent) {
    parent.childIds = [...parent.childIds, id];
  } else {
    snap.game.rootIds = [...snap.game.rootIds, id];
  }
  snap.game = rebuildMainLine(snap.game);
  snap.currentNodeId = id;
  return commit(session, snap);
}

export function editorSetComment(
  session: OpeningEditorSession,
  comment: string,
): OpeningEditorSession {
  const node = editorCurrentNode(session);
  if (!node) return session;
  const trimmed = comment.trim();
  const current = node.comment?.trim() ?? '';
  if (current === trimmed) return session;
  const snap = cloneSnapshot(session.snapshot);
  const next = snap.game.nodesById[node.id]!;
  next.comment = trimmed ? trimmed : undefined;
  snap.game = rebuildMainLine(snap.game);
  return commit(session, snap);
}

export function editorClearComment(session: OpeningEditorSession): OpeningEditorSession {
  return editorSetComment(session, '');
}

export function editorSetNags(
  session: OpeningEditorSession,
  nags: string[],
): OpeningEditorSession {
  const node = editorCurrentNode(session);
  if (!node) return session;
  const nextNags = nags.filter(Boolean);
  const current = node.nags ?? [];
  if (
    current.length === nextNags.length &&
    current.every((n, i) => n === nextNags[i])
  ) {
    return session;
  }
  const snap = cloneSnapshot(session.snapshot);
  const next = snap.game.nodesById[node.id]!;
  next.nags = nextNags.length ? [...nextNags] : undefined;
  snap.game = rebuildMainLine(snap.game);
  return commit(session, snap);
}

export function editorToggleNag(
  session: OpeningEditorSession,
  nag: string,
): OpeningEditorSession {
  const node = editorCurrentNode(session);
  if (!node) return session;
  const glyphToNag: Record<string, string> = {
    '!': '$1',
    '?': '$2',
    '!!': '$3',
    '??': '$4',
    '!?': '$5',
    '?!': '$6',
  };
  const key = glyphToNag[nag] ?? (nag.startsWith('$') ? nag : `$${nag}`);
  const current = node.nags ?? [];
  const next = current.includes(key)
    ? current.filter((n) => n !== key)
    : [...current, key];
  return editorSetNags(session, next);
}

export function editorDeleteCurrentVariation(
  session: OpeningEditorSession,
): OpeningEditorSession {
  const node = editorCurrentNode(session);
  if (!node) return session;
  const snap = cloneSnapshot(session.snapshot);
  const parentId = node.parentId;
  const siblings = parentId
    ? snap.game.nodesById[parentId]!.childIds
    : snap.game.rootIds;
  const nextSiblings = siblings.filter((id) => id !== node.id);
  if (parentId) {
    snap.game.nodesById[parentId]!.childIds = nextSiblings.map((id, i) => {
      const n = snap.game.nodesById[id]!;
      n.variationIndex = i;
      return id;
    });
  } else {
    snap.game.rootIds = nextSiblings.map((id, i) => {
      const n = snap.game.nodesById[id]!;
      n.variationIndex = i;
      return id;
    });
  }
  deleteSubtree(snap.game, node.id);
  snap.game = rebuildMainLine(snap.game);
  snap.currentNodeId = parentId;
  return commit(session, snap);
}

function deleteSubtree(game: ReaderGame, nodeId: string): void {
  const node = game.nodesById[nodeId];
  if (!node) return;
  for (const child of node.childIds) deleteSubtree(game, child);
  delete game.nodesById[nodeId];
}

export function editorSetDisplayName(
  session: OpeningEditorSession,
  displayName: string,
): OpeningEditorSession {
  return withDirty({
    ...session,
    snapshot: { ...session.snapshot, displayName },
  });
}

export function editorMarkSaved(session: OpeningEditorSession, fileId: string): OpeningEditorSession {
  return {
    ...session,
    dirty: false,
    fileId,
    baselinePgn: serializeOpeningPgn(session.snapshot.headers, session.snapshot.game),
    baselineName: session.snapshot.displayName,
  };
}

export function editorCanGoBack(session: OpeningEditorSession): boolean {
  return Boolean(session.snapshot.currentNodeId);
}

export function editorCanGoForward(session: OpeningEditorSession): boolean {
  return editorChildIds(session).length > 0;
}

export function editorNodeComment(session: OpeningEditorSession): string {
  return editorCurrentNode(session)?.comment ?? '';
}

export function editorTrySan(
  session: OpeningEditorSession,
  san: string,
): PlayEditorMoveResult | null {
  const chess = new Chess(editorCurrentFen(session));
  let played: Move | null = null;
  try {
    played = chess.move(san);
  } catch {
    return null;
  }
  if (!played) return null;
  return editorPlaySan(session, played);
}

/**
 * Follow existing children or append new ones. Used when grafting an analysed
 * line — never asks for variation confirmation, never duplicates a SAN.
 */
export function editorGraftSans(
  session: OpeningEditorSession,
  sans: readonly string[],
): OpeningEditorSession {
  let current = session;
  for (const san of sans) {
    const result = editorTrySan(current, san);
    if (!result) break;
    if (result.kind === 'confirm-variation') {
      current = editorAppendMove(current, result.move);
    } else {
      current = result.session;
    }
  }
  return current;
}

export function editorGoParent(session: OpeningEditorSession): OpeningEditorSession {
  const node = editorCurrentNode(session);
  if (!node) return session;
  return editorSelectNode(session, node.parentId);
}

/** Used by study auto-tab: comments if text exists, else notation. */
export function preferredStudyTab(comment: string): 'comments' | 'notation' {
  return comment.trim().length > 0 ? 'comments' : 'notation';
}
