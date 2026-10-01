import { pgnCommentTranslationStore } from './PgnCommentTranslationStore.ts';
import { pgnTranslationQueue } from './PgnTranslationQueue.ts';
import {
  collectPgnCommentUnits,
  commentsToQueue,
  summarizeFileComments,
} from './collectComments.ts';
import type { PgnCommentSource } from './types.ts';

export type ExistingPgnRef = {
  source: PgnCommentSource;
  fileId: string;
  pgnText: string;
};

/** Never throws — import/read stay available if translation waits or fails. */
export async function scheduleImportedPgnComments(
  pgnText: string,
  source: PgnCommentSource,
  fileId: string,
): Promise<number> {
  try {
    const added = await pgnTranslationQueue.enqueuePgn(pgnText, source, fileId);
    if (added > 0) {
      void pgnTranslationQueue.processNext();
    }
    return added;
  } catch {
    return 0;
  }
}

export async function enqueueExistingPgns(files: readonly ExistingPgnRef[]): Promise<number> {
  let added = 0;
  for (const file of files) {
    if (!file.pgnText.trim()) continue;
    added += await pgnTranslationQueue.enqueuePgn(file.pgnText, file.source, file.fileId);
  }
  if (added > 0) {
    void pgnTranslationQueue.processNext();
  }
  return added;
}

export async function prunePgnCommentFile(
  source: PgnCommentSource,
  fileId: string,
): Promise<void> {
  try {
    await pgnCommentTranslationStore.pruneFile(source, fileId);
  } catch {
    // deletion of the study must not fail because the sidecar is missing
  }
}

export function describePgnFileTranslation(
  source: PgnCommentSource,
  fileId: string,
  pgnText: string,
) {
  const units = collectPgnCommentUnits(pgnText, source, fileId);
  const summary = summarizeFileComments(units);
  const english = commentsToQueue(units).length;
  const status = pgnCommentTranslationStore.fileStatus(source, fileId, english);
  return { units, summary, english, status };
}
