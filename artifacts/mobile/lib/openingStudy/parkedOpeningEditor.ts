/**
 * In-memory parking for the visual PGN editor while AnyLyseur is open.
 * Never written to the repertoire store — comments and undo history stay in RAM.
 */
import type { OpeningEditorSession } from './openingEditorState.ts';

export type ParkedOpeningEditorKind = 'analyze-return' | 'new-study';

export type ParkedOpeningEditor = {
  session: OpeningEditorSession;
  commentDraft: string;
  side: 'white' | 'black';
  originNodeId: string | null;
  kind: ParkedOpeningEditorKind;
};

let current: ParkedOpeningEditor | null = null;

export function setParkedOpeningEditor(
  parked: ParkedOpeningEditor | null,
): void {
  current = parked;
}

export function peekParkedOpeningEditor(): ParkedOpeningEditor | null {
  return current;
}

export function clearParkedOpeningEditor(): void {
  current = null;
}

export function takeParkedOpeningEditor(match?: {
  fileId?: string | null;
  folderId?: string | null;
}): ParkedOpeningEditor | null {
  if (!current) return null;
  if (match?.fileId) {
    if (current.session.fileId !== match.fileId) return null;
  } else if (match?.folderId) {
    if (current.session.fileId) return null;
    if (current.session.folderId !== match.folderId) return null;
  }
  const taken = current;
  current = null;
  return taken;
}

export function __resetParkedOpeningEditorForTests(): void {
  current = null;
}
