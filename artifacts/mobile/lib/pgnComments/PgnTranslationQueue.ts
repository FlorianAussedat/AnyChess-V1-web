import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { commentsToQueue, collectPgnCommentUnits, commentAnchorKey } from './collectComments.ts';
import { pgnCommentTranslationStore } from './PgnCommentTranslationStore.ts';
import { defaultPgnTranslationProvider } from './provider.ts';
import { fingerprintComment } from './fingerprint.ts';
import type {
  PgnCommentSource,
  PgnCommentUnit,
  PgnTranslationJob,
  PgnTranslationProvider,
  PgnTranslationQueueSnapshot,
} from './types.ts';

const KEY = StorageKeys.pgnTranslationQueue.key;
const BATCH = 8;

function emptySnapshot(): PgnTranslationQueueSnapshot {
  return { version: 1, jobs: {} };
}

function validate(parsed: unknown): PgnTranslationQueueSnapshot | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const row = parsed as { version?: unknown; jobs?: unknown };
  if (row.version !== 1) return null;
  if (!row.jobs || typeof row.jobs !== 'object' || Array.isArray(row.jobs)) return null;
  return { version: 1, jobs: { ...(row.jobs as PgnTranslationQueueSnapshot['jobs']) } };
}

export class PgnTranslationQueue {
  private snapshot: PgnTranslationQueueSnapshot | null = null;
  private running = false;
  private cancelled = false;
  private provider: PgnTranslationProvider = defaultPgnTranslationProvider;
  private readonly translations: PgnCommentTranslationStore;

  constructor(
    private readonly storage: KeyValueStorage,
    translations: PgnCommentTranslationStore = pgnCommentTranslationStore,
  ) {
    this.translations = translations;
  }

  setProvider(provider: PgnTranslationProvider): void {
    this.provider = provider;
  }

  async ensureLoaded(): Promise<PgnTranslationQueueSnapshot> {
    if (this.snapshot) return this.snapshot;
    const result = await loadStoredJson(this.storage, KEY, emptySnapshot(), validate);
    this.snapshot = result.value;
    return this.snapshot;
  }

  getSnapshot(): PgnTranslationQueueSnapshot {
    return this.snapshot ?? emptySnapshot();
  }

  pendingCount(): number {
    return Object.values(this.getSnapshot().jobs).filter(
      (j) => j.status === 'queued' || j.status === 'running',
    ).length;
  }

  async enqueueUnits(units: readonly PgnCommentUnit[]): Promise<number> {
    await this.ensureLoaded();
    await this.translations.ensureLoaded();
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot!.jobs };
    let added = 0;
    for (const unit of commentsToQueue(units)) {
      const existing = this.translations.getRecord(unit.anchor);
      if (
        existing &&
        existing.originalFingerprint === unit.fingerprint &&
        (existing.status === 'ready' || existing.status === 'manual')
      ) {
        continue;
      }
      const id = commentAnchorKey(unit.anchor);
      const prev = jobs[id];
      if (prev && (prev.status === 'queued' || prev.status === 'running')) continue;
      jobs[id] = {
        id,
        source: unit.anchor.source,
        fileId: unit.anchor.fileId,
        gameIndex: unit.anchor.gameIndex,
        commentId: id,
        fingerprint: unit.fingerprint,
        original: unit.original,
        context: `${unit.anchor.nodeId}:${unit.anchor.slot}`,
        status: 'queued',
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
      };
      added += 1;
    }
    this.snapshot = { version: 1, jobs };
    await this.persist();
    return added;
  }

  async enqueuePgn(
    pgnText: string,
    source: PgnCommentSource,
    fileId: string,
  ): Promise<number> {
    return this.enqueueUnits(collectPgnCommentUnits(pgnText, source, fileId));
  }

  cancel(): void {
    this.cancelled = true;
  }

  async processNext(limit = BATCH): Promise<{ done: number; failed: number; blocked: string | null }> {
    await this.ensureLoaded();
    if (this.running) return { done: 0, failed: 0, blocked: null };
    this.running = true;
    this.cancelled = false;
    let done = 0;
    let failed = 0;
    let blocked: string | null = null;
    try {
      const queued = Object.values(this.snapshot!.jobs)
        .filter((j) => j.status === 'queued')
        .slice(0, limit);
      if (queued.length === 0) return { done, failed, blocked };
      if (!this.provider.configured) {
        blocked = 'not_configured';
        return { done, failed, blocked };
      }
      const results = await this.provider.translateComments(
        queued.map((j) => ({ id: j.id, text: j.original, context: j.context })),
      );
      const now = new Date().toISOString();
      const jobs = { ...this.snapshot!.jobs };
      for (const job of queued) {
        if (this.cancelled) {
          jobs[job.id] = { ...job, status: 'cancelled', updatedAt: now };
          continue;
        }
        const result = results.find((r) => r.id === job.id);
        const recAnchor = parseJobAnchor(job);
        if (!result || result.error || !result.text) {
          jobs[job.id] = {
            ...job,
            status: result?.error === 'not_configured' ? 'queued' : 'failed',
            error: result?.error,
            updatedAt: now,
          };
          if (result?.error === 'not_configured') blocked = 'not_configured';
          else failed += 1;
          continue;
        }
        if (fingerprintComment(job.original) !== job.fingerprint) {
          jobs[job.id] = { ...job, status: 'failed', error: 'stale', updatedAt: now };
          failed += 1;
          continue;
        }
        const existing = this.translations.getRecord(recAnchor);
        if (existing?.method === 'manual' && existing.status === 'manual') {
          jobs[job.id] = { ...job, status: 'done', updatedAt: now };
          done += 1;
          continue;
        }
        await this.translations.upsert({
          anchor: recAnchor,
          sourceLang: 'en',
          targetLang: 'fr',
          originalFingerprint: job.fingerprint,
          originalText: job.original,
          translatedText: result.text,
          status: 'ready',
          method: 'automatic',
          previousManualText: existing?.previousManualText,
        });
        jobs[job.id] = { ...job, status: 'done', updatedAt: now };
        done += 1;
      }
      this.snapshot = { version: 1, jobs };
      await this.persist();
    } finally {
      this.running = false;
    }
    return { done, failed, blocked };
  }

  resetForTests(): void {
    this.snapshot = emptySnapshot();
    this.running = false;
    this.cancelled = false;
    this.provider = defaultPgnTranslationProvider;
  }

  private async persist(): Promise<void> {
    if (!this.snapshot) return;
    await this.storage.setItem(KEY, JSON.stringify(this.snapshot));
  }
}

function parseJobAnchor(job: PgnTranslationJob) {
  const parts = job.id.split(':');
  return {
    source: (parts[0] as PgnCommentSource) ?? job.source,
    fileId: parts[1] ?? job.fileId,
    gameIndex: Number(parts[2] ?? job.gameIndex),
    nodeId: parts[3] ?? 'n1',
    slot: (parts[4] as 'start' | 'before' | 'after') ?? 'after',
  };
}

export const pgnTranslationQueue = new PgnTranslationQueue(defaultKeyValueStorage);
