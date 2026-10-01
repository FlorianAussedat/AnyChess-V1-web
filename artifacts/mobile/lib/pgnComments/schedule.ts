import { preferencesStore, type PreferencesStore } from '../preferences/PreferencesStore.ts';
import type { UserPreferences } from '../preferences/types.ts';
import { pgnCommentTranslationStore } from './PgnCommentTranslationStore.ts';
import { pgnTranslationQueue, type PgnTranslationQueue } from './PgnTranslationQueue.ts';
import {
  collectPgnCommentUnits,
  commentsToQueue,
  summarizeFileComments,
} from './collectComments.ts';
import type {
  PgnCommentSource,
  PgnTranslationJobOrigin,
  PgnTranslationPolicy,
} from './types.ts';
import { markPgnTranslateRetryStarted } from './pgnTranslateProbe.ts';

export type ExistingPgnRef = {
  source: PgnCommentSource;
  fileId: string;
  pgnText: string;
};

export type PgnTranslationScheduleDeps = {
  queue?: PgnTranslationQueue;
  preferences?: PreferencesStore;
  collectFiles?: () => Promise<ExistingPgnRef[]>;
  start?: boolean;
  waitForPump?: boolean;
};

export function policyFromPreferences(prefs: UserPreferences): PgnTranslationPolicy {
  return {
    catchup: prefs.translateExistingPgnComments === true,
    import: prefs.translateImportedPgnComments === true,
  };
}

export function shouldTranslateOnImport(prefs: UserPreferences): boolean {
  return prefs.translateImportedPgnComments === true;
}

export async function collectLibraryPgns(): Promise<ExistingPgnRef[]> {
  const out: ExistingPgnRef[] = [];
  try {
    const { repertoireService } = await import('../repertoire/RepertoireService.ts');
    await repertoireService.ensureLoaded();
    for (const file of repertoireService.getAllFiles()) {
      if (file.pgnText?.trim()) {
        out.push({ source: 'repertoire', fileId: file.id, pgnText: file.pgnText });
      }
    }
  } catch {
    // libraries stay usable even if one source cannot be listed
  }
  try {
    const { gameLibraryStore } = await import('../gameLibrary/GameLibraryStore.ts');
    const games = await gameLibraryStore.listGames();
    for (const game of games) {
      const pgn = game.source.rawPgn?.trim();
      if (pgn) out.push({ source: 'gameLibrary', fileId: game.id, pgnText: pgn });
    }
  } catch {
    // same
  }
  return out;
}

function resolveDeps(deps?: PgnTranslationScheduleDeps) {
  return {
    queue: deps?.queue ?? pgnTranslationQueue,
    preferences: deps?.preferences ?? preferencesStore,
    collectFiles: deps?.collectFiles ?? collectLibraryPgns,
  };
}

/** Never throws — import/read stay available if translation waits or fails. */
export async function scheduleImportedPgnComments(
  pgnText: string,
  source: PgnCommentSource,
  fileId: string,
  deps?: PgnTranslationScheduleDeps,
): Promise<number> {
  try {
    const { queue, preferences } = resolveDeps(deps);
    await preferences.ensureLoaded();
    const prefs = preferences.getPreferences();
    if (!shouldTranslateOnImport(prefs)) return 0;
    queue.setPolicy(policyFromPreferences(prefs));
    const added = await queue.enqueuePgn(pgnText, source, fileId, 'import');
    if (added > 0) {
      void queue.processUntilIdle();
    }
    return added;
  } catch {
    return 0;
  }
}

export async function enqueueExistingPgns(
  files: readonly ExistingPgnRef[],
  options?: { origin?: PgnTranslationJobOrigin; start?: boolean },
  queue: PgnTranslationQueue = pgnTranslationQueue,
): Promise<number> {
  const origin = options?.origin ?? 'catchup';
  let added = 0;
  for (const file of files) {
    if (!file.pgnText.trim()) continue;
    added += await queue.enqueuePgn(file.pgnText, file.source, file.fileId, origin);
  }
  if (added > 0 && options?.start) {
    void queue.processUntilIdle();
  }
  return added;
}

export async function applyPgnTranslationPreferences(
  deps?: PgnTranslationScheduleDeps,
): Promise<void> {
  const { queue, preferences, collectFiles } = resolveDeps(deps);
  await preferences.ensureLoaded();
  await queue.ensureLoaded();
  const prefs = preferences.getPreferences();
  const policy = policyFromPreferences(prefs);
  queue.setPolicy(policy);
  if (policy.catchup) {
    await enqueueExistingPgns(await collectFiles(), { origin: 'catchup', start: false }, queue);
    await queue.resumeOrigins(['catchup']);
  } else {
    await queue.pauseOrigins(['catchup']);
  }
  if (policy.import) {
    await queue.resumeOrigins(['import']);
  } else {
    await queue.pauseOrigins(['import']);
  }
  if ((policy.catchup || policy.import) && deps?.start !== false) {
    const pump = queue.processUntilIdle();
    if (deps?.waitForPump) await pump;
    else void pump;
  }
}

/**
 * After restart: remap leftover running jobs, apply persisted options,
 * and resume only work still allowed. Does not invent a mass catch-up
 * when both options are off.
 */
export async function reconcilePgnTranslationAfterBoot(
  deps?: PgnTranslationScheduleDeps,
): Promise<void> {
  try {
    await applyPgnTranslationPreferences(deps);
  } catch {
    // boot must not fail because translation is paused or empty
  }
}

export async function retryPgnTranslation(deps?: PgnTranslationScheduleDeps): Promise<void> {
  const { queue, preferences } = resolveDeps(deps);
  await preferences.ensureLoaded();
  markPgnTranslateRetryStarted(queue.getLastError());
  queue.setPolicy(policyFromPreferences(preferences.getPreferences()));
  await queue.retryBlocked();
  void queue.processUntilIdle();
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
  const alreadyFrench =
    english === 0 &&
    units.some((unit) => unit.language === 'fr' && !unit.technicalOnly);
  return { units, summary, english, status, alreadyFrench };
}
