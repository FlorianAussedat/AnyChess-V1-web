/**
 * Bridge between the visual opening PGN editor and the general AnyLyseur.
 */
import { EXPLORATION_ORIGIN_START } from '../gameReader/explorationMoves.ts';
import type { ReaderGame, ReaderNode } from '../gameReader/types.ts';
import {
  openExercisePositionInAnalyzer,
  type ExerciseAnalyzerOpen,
} from '../gameLibrary/openExerciseAnalyzer.ts';
import {
  createEmptyEditorSession,
  editorGraftSans,
  type OpeningEditorSession,
} from './openingEditorState.ts';
import {
  peekParkedOpeningEditor,
  setParkedOpeningEditor,
  type ParkedOpeningEditor,
} from './parkedOpeningEditor.ts';

export const OPENING_EDITOR_ANALYZER_SOURCE = 'opening-editor';

/**
 * SAN path from an exclusive origin (start or a node) to the inclusive cursor.
 * Empty when the cursor is still on the origin.
 */
export function nodePathSans(
  game: ReaderGame,
  fromExclusive: string | null,
  toInclusive: string | null,
): string[] {
  if (!toInclusive) return [];
  const originKey = fromExclusive ?? EXPLORATION_ORIGIN_START;
  const cursorKey = toInclusive;
  if (cursorKey === originKey) return [];

  const sans: string[] = [];
  const seen = new Set<string>();
  let id: string | null = toInclusive;
  while (id) {
    if (seen.has(id)) break;
    seen.add(id);
    const node: ReaderNode | undefined = game.nodesById[id];
    if (!node) break;
    sans.push(node.san);
    const parentKey = node.parentId ?? EXPLORATION_ORIGIN_START;
    if (parentKey === originKey) break;
    id = node.parentId;
  }
  return sans.reverse();
}

export function analyzedLineSans(input: {
  game: ReaderGame;
  explorationOriginNodeId: string | null;
  currentNodeId: string | null;
}): string[] {
  return nodePathSans(
    input.game,
    input.explorationOriginNodeId,
    input.currentNodeId,
  );
}

export async function openEditorPositionInAnalyzer(input: {
  fen: string;
  flipped?: boolean;
}): Promise<ExerciseAnalyzerOpen | null> {
  return openExercisePositionInAnalyzer({
    fen: input.fen,
    flipped: input.flipped,
    source: OPENING_EDITOR_ANALYZER_SOURCE,
    explorationOriginNodeId: EXPLORATION_ORIGIN_START,
  });
}

export function graftAnalyzedLineOntoParkedEditor(
  analyzerGame: ReaderGame,
  explorationOriginNodeId: string | null,
  currentNodeId: string | null,
  parked: ParkedOpeningEditor | null = peekParkedOpeningEditor(),
): ParkedOpeningEditor | null {
  if (!parked) return null;
  const sans = analyzedLineSans({
    game: analyzerGame,
    explorationOriginNodeId,
    currentNodeId,
  });
  const session = editorGraftSans(parked.session, sans);
  const next: ParkedOpeningEditor = {
    ...parked,
    session,
    commentDraft: session.snapshot.currentNodeId
      ? (session.snapshot.game.nodesById[session.snapshot.currentNodeId]
          ?.comment ?? '')
      : parked.commentDraft,
  };
  setParkedOpeningEditor(next);
  return next;
}

export function createOpeningStudySession(input: {
  folderId: string;
  displayName: string;
  initialFen: string;
  sans?: readonly string[];
}): OpeningEditorSession {
  let session = createEmptyEditorSession({
    folderId: input.folderId,
    displayName: input.displayName,
    initialFen: input.initialFen,
  });
  if (input.sans && input.sans.length > 0) {
    session = editorGraftSans(session, input.sans);
  }
  return session;
}
