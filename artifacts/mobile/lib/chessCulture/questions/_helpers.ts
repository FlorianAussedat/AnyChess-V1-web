/**
 * Shared draft helper for modular culture-quiz question banks.
 */
import type { ChessCultureQuestion } from '../types.ts';

export type QuestionDraft = Omit<
  ChessCultureQuestion,
  'revision' | 'active' | 'sourceType' | 'tags'
> & {
  tags?: string[];
  sourceType?: ChessCultureQuestion['sourceType'];
  revision?: number;
  active?: boolean;
};

export function defineQuestion(draft: QuestionDraft): ChessCultureQuestion {
  return {
    revision: draft.revision ?? 1,
    active: draft.active ?? true,
    sourceType: draft.sourceType ?? 'stable-fact',
    tags: draft.tags ?? [],
    ...draft,
  };
}
