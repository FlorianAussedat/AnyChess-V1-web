/**
 * In-memory handoff from the import screen into AnyLyseur
 * without writing the game library first.
 */
export type ParkedAnalyzerDraft = {
  pgnText?: string;
  fen?: string;
  tab?: 'game' | 'analysis';
  displayName?: string;
};

export const ANALYZER_DRAFT_HANDOFF = 'draft';

let current: ParkedAnalyzerDraft | null = null;

export function setParkedAnalyzerDraft(draft: ParkedAnalyzerDraft | null): void {
  current = draft;
}

export function takeParkedAnalyzerDraft(): ParkedAnalyzerDraft | null {
  const taken = current;
  current = null;
  return taken;
}

export function peekParkedAnalyzerDraft(): ParkedAnalyzerDraft | null {
  return current;
}

export function __resetParkedAnalyzerDraftForTests(): void {
  current = null;
}
