/**
 * Hand off a picked PGN file into the existing visual editor
 * without importing it into a repertoire folder first.
 */
import {
  editorNodeComment,
  loadEditorSessionFromPgn,
} from './openingEditorState.ts';
import { setParkedOpeningEditor } from './parkedOpeningEditor.ts';

export const EXTERNAL_OPENING_EDITOR_HANDOFF = 'external';

export function parkExternalOpeningPgn(input: {
  pgnText: string;
  displayName: string;
  side?: 'white' | 'black';
}): void {
  const loaded = loadEditorSessionFromPgn({
    pgnText: input.pgnText,
    folderId: '',
    displayName: input.displayName,
    fileId: null,
  });
  const session = {
    ...loaded,
    dirty: true,
    baselinePgn: '',
  };
  setParkedOpeningEditor({
    session,
    commentDraft: editorNodeComment(session),
    side: input.side ?? 'white',
    originNodeId: session.snapshot.currentNodeId,
    kind: 'external-edit',
    handoff: EXTERNAL_OPENING_EDITOR_HANDOFF,
  });
}
