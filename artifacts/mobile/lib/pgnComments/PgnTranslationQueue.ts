import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { commentsToQueue, collectPgnCommentUnits, commentAnchorKey } from './collectComments.ts';
import {
  PgnCommentTranslationStore,
  pgnCommentTranslationStore,
} from './PgnCommentTranslationStore.ts';
import { isEchoTranslation } from './fingerprint.ts';
import { defaultPgnTranslationProvider } from './provider.ts';
import { fingerprintComment } from './fingerprint.ts';
import type {
  PgnCommentSource,
  PgnCommentUnit,
  PgnTranslationJob,
  PgnTranslationJobOrigin,
  PgnTranslationPolicy,
  PgnTranslationProgress,
  PgnTranslationProvider,
  PgnTranslationProviderError,
  PgnTranslationQueueSnapshot,
} from './types.ts';

const KEY = StorageKeys.pgnTranslationQueue.key;
const BATCH = 8;
export const PGN_TRANSLATE_TIMEOUT_MS = 12_000;

export type PgnTranslationServiceError =
  | PgnTranslationProviderError
  | 'failed'
  | null;

function emptySnapshot(): PgnTranslationQueueSnapshot {
  return { version: 1, jobs: {} };
}

function asOrigin(value: unknown): PgnTranslationJobOrigin {
  return value === 'import' ? 'import' : 'catchup';
}

function normalizeJob(raw: PgnTranslationJob): PgnTranslationJob {
  const status =
    raw.status === 'running'
      ? 'queued'
      : raw.status === 'paused' ||
          raw.status === 'done' ||
          raw.status === 'failed' ||
          raw.status === 'cancelled' ||
          raw.status === 'queued'
        ? raw.status
        : 'queued';
  return {
    ...raw,
    origin: asOrigin(raw.origin),
    status,
  };
}

function validate(parsed: unknown): PgnTranslationQueueSnapshot | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const row = parsed as { version?: unknown; jobs?: unknown };
  if (row.version !== 1) return null;
  if (!row.jobs || typeof row.jobs !== 'object' || Array.isArray(row.jobs)) return null;
  const jobs: PgnTranslationQueueSnapshot['jobs'] = {};
  for (const [id, value] of Object.entries(row.jobs as Record<string, PgnTranslationJob>)) {
    if (!value || typeof value !== 'object') continue;
    jobs[id] = normalizeJob(value);
  }
  return { version: 1, jobs };
}

function jobAllowed(job: PgnTranslationJob, policy: PgnTranslationPolicy): boolean {
  return job.origin === 'import' ? policy.import : policy.catchup;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class PgnTranslationQueue {
  private snapshot: PgnTranslationQueueSnapshot | null = null;
  private running = false;
  private pumping = false;
  private pumpQueued = false;
  private cancelled = false;
  private runGeneration = 0;
  private lastError: PgnTranslationServiceError = null;
  private policy: PgnTranslationPolicy = { catchup: true, import: true };
  private readonly listeners = new Set<() => void>();
  private provider: PgnTranslationProvider = defaultPgnTranslationProvider;
  private readonly translations: PgnCommentTranslationStore;
  private readonly storage: KeyValueStorage;
  private readonly timeoutMs: number;

  constructor(
    storage: KeyValueStorage,
    translations: PgnCommentTranslationStore = pgnCommentTranslationStore,
    options?: { timeoutMs?: number },
  ) {
    this.storage = storage;
    this.translations = translations;
    this.timeoutMs = options?.timeoutMs ?? PGN_TRANSLATE_TIMEOUT_MS;
  }

  setProvider(provider: PgnTranslationProvider): void {
    this.provider = provider;
  }

  setPolicy(policy: PgnTranslationPolicy): void {
    this.policy = { ...policy };
  }

  getPolicy(): PgnTranslationPolicy {
    return { ...this.policy };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getLastError(): PgnTranslationServiceError {
    return this.lastError;
  }

  isBusy(): boolean {
    return this.running || this.pumping;
  }

  private setLastError(error: PgnTranslationServiceError): void {
    if (this.lastError === error) return;
    this.lastError = error;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async ensureLoaded(): Promise<PgnTranslationQueueSnapshot> {
    if (this.snapshot) return this.snapshot;
    const result = await loadStoredJson(this.storage, KEY, emptySnapshot(), validate);
    this.snapshot = result.value;
    if (Object.keys(this.snapshot.jobs).length > 0) {
      await this.persist();
    }
    return this.snapshot;
  }

  getSnapshot(): PgnTranslationQueueSnapshot {
    return this.snapshot ?? emptySnapshot();
  }

  pendingCount(): number {
    return Object.values(this.getSnapshot().jobs).filter(
      (j) => j.status === 'queued' || j.status === 'running' || j.status === 'paused',
    ).length;
  }

  getProgress(): PgnTranslationProgress {
    const jobs = Object.values(this.getSnapshot().jobs);
    const translated = jobs.filter((j) => j.status === 'done').length;
    const pending = jobs.filter(
      (j) => j.status === 'queued' || j.status === 'running' || j.status === 'paused',
    ).length;
    const failed = jobs.filter((j) => j.status === 'failed').length;
    const total = translated + pending + failed;
    const paused = jobs.some((j) => j.status === 'paused');
    const queuedAllowed = jobs.some(
      (j) => (j.status === 'queued' || j.status === 'running') && jobAllowed(j, this.policy),
    );
    let phase: PgnTranslationProgress['phase'] = 'empty';
    if (total === 0) {
      phase = 'empty';
    } else if (this.lastError) {
      phase = 'error';
    } else if (pending === 0 && failed === 0) {
      phase = 'complete';
    } else if (this.running || this.pumping || queuedAllowed) {
      phase = 'running';
    } else if (paused || pending > 0) {
      phase = 'paused';
    } else if (failed > 0) {
      phase = 'error';
    }
    return {
      translated,
      pending,
      failed,
      total,
      phase,
      error: this.lastError,
    };
  }

  async enqueueUnits(
    units: readonly PgnCommentUnit[],
    origin: PgnTranslationJobOrigin = 'catchup',
  ): Promise<number> {
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
        (existing.status === 'ready' || existing.status === 'manual') &&
        existing.translatedText
      ) {
        continue;
      }
      const id = commentAnchorKey(unit.anchor);
      const prev = jobs[id];
      if (prev && prev.fingerprint === unit.fingerprint) {
        if (prev.status === 'queued' || prev.status === 'running' || prev.status === 'paused') {
          continue;
        }
        if (prev.status === 'done') continue;
      }
      jobs[id] = {
        id,
        source: unit.anchor.source,
        fileId: unit.anchor.fileId,
        gameIndex: unit.anchor.gameIndex,
        commentId: id,
        fingerprint: unit.fingerprint,
        original: unit.original,
        context: `${unit.anchor.nodeId}:${unit.anchor.slot}`,
        origin: prev?.origin ?? origin,
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
    origin: PgnTranslationJobOrigin = 'catchup',
  ): Promise<number> {
    return this.enqueueUnits(collectPgnCommentUnits(pgnText, source, fileId), origin);
  }

  /** Sync pause so in-flight work cannot resume the queue. */
  cancel(): void {
    this.cancelled = true;
    this.runGeneration += 1;
    if (!this.snapshot) return;
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot.jobs };
    for (const job of Object.values(jobs)) {
      if (job.status === 'queued' || job.status === 'running') {
        jobs[job.id] = { ...job, status: 'paused', updatedAt: now };
      }
    }
    this.snapshot = { version: 1, jobs };
    void this.persist();
  }

  async pauseOrigins(origins: readonly PgnTranslationJobOrigin[]): Promise<void> {
    await this.ensureLoaded();
    this.runGeneration += 1;
    this.cancelled = true;
    const allow = new Set(origins);
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot!.jobs };
    let changed = false;
    for (const job of Object.values(jobs)) {
      if (!allow.has(job.origin)) continue;
      if (job.status === 'queued' || job.status === 'running') {
        jobs[job.id] = { ...job, status: 'paused', updatedAt: now };
        changed = true;
      }
    }
    if (!changed) {
      this.emit();
      return;
    }
    this.snapshot = { version: 1, jobs };
    await this.persist();
  }

  async resumeOrigins(origins: readonly PgnTranslationJobOrigin[]): Promise<number> {
    await this.ensureLoaded();
    const allow = new Set(origins);
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot!.jobs };
    let resumed = 0;
    for (const job of Object.values(jobs)) {
      if (!allow.has(job.origin)) continue;
      if (job.status === 'paused' || job.status === 'failed' || job.status === 'cancelled') {
        jobs[job.id] = { ...job, status: 'queued', error: undefined, updatedAt: now };
        resumed += 1;
      }
    }
    this.cancelled = false;
    this.snapshot = { version: 1, jobs };
    await this.persist();
    return resumed;
  }

  async retryBlocked(): Promise<number> {
    await this.ensureLoaded();
    this.setLastError(null);
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot!.jobs };
    let n = 0;
    for (const job of Object.values(jobs)) {
      if (!jobAllowed(job, this.policy)) continue;
      if (job.status === 'failed' || job.status === 'paused' || job.status === 'cancelled') {
        jobs[job.id] = { ...job, status: 'queued', error: undefined, updatedAt: now };
        n += 1;
      }
    }
    this.cancelled = false;
    this.snapshot = { version: 1, jobs };
    await this.persist();
    return n;
  }

  async processNext(limit = BATCH): Promise<{ done: number; failed: number; blocked: string | null }> {
    await this.ensureLoaded();
    if (this.running) return { done: 0, failed: 0, blocked: null };
    this.running = true;
    this.cancelled = false;
    const generation = this.runGeneration;
    let done = 0;
    let failed = 0;
    let blocked: string | null = null;
    const queued = Object.values(this.snapshot!.jobs)
      .filter((j) => j.status === 'queued' && jobAllowed(j, this.policy))
      .slice(0, limit);
    try {
      if (queued.length === 0) return { done, failed, blocked };
      if (!this.provider.configured) {
        blocked = 'not_configured';
        this.setLastError('not_configured');
        return { done, failed, blocked };
      }
      const now = new Date().toISOString();
      const claimed = { ...this.snapshot!.jobs };
      for (const job of queued) {
        claimed[job.id] = { ...job, status: 'running', updatedAt: now };
      }
      this.snapshot = { version: 1, jobs: claimed };
      await this.persist();

      let results: Awaited<ReturnType<PgnTranslationProvider['translateComments']>>;
      try {
        results = await withTimeout(
          this.provider.translateComments(
            queued.map((j) => ({ id: j.id, text: j.original, context: j.context })),
          ),
          this.timeoutMs,
        );
      } catch (error) {
        const timedOut = error instanceof Error && error.message === 'timeout';
        blocked = timedOut ? 'timeout' : 'offline';
        this.setLastError(timedOut ? 'timeout' : 'offline');
        await this.restoreInFlight(queued, generation);
        return { done, failed, blocked };
      }

      const late = generation !== this.runGeneration;
      const jobs = { ...this.snapshot!.jobs };
      for (const job of queued) {
        const result = results.find((r) => r.id === job.id);
        const recAnchor = parseJobAnchor(job);
        const current = jobs[job.id] ?? job;
        if (late) {
          if (result?.text && !result.error && !isEchoTranslation(job.original, result.text)) {
            if (fingerprintComment(job.original) === job.fingerprint) {
              const existing = this.translations.getRecord(recAnchor);
              if (!(existing?.method === 'manual' && existing.status === 'manual')) {
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
              }
              jobs[job.id] = { ...current, status: 'done', error: undefined, updatedAt: now };
              done += 1;
            }
          }
          continue;
        }
        if (this.cancelled || current.status === 'paused') {
          jobs[job.id] = { ...current, status: 'paused', updatedAt: now };
          continue;
        }
        if (!result || result.error || !result.text || isEchoTranslation(job.original, result.text)) {
          const keepQueued =
            result?.error === 'not_configured' ||
            result?.error === 'quota' ||
            result?.error === 'offline' ||
            result?.error === 'timeout';
          const echo = Boolean(result?.text && isEchoTranslation(job.original, result.text));
          jobs[job.id] = {
            ...job,
            status: keepQueued ? 'queued' : 'failed',
            error: echo ? 'rejected' : result?.error ?? 'rejected',
            updatedAt: now,
          };
          if (result?.error === 'quota') {
            blocked = 'quota';
            this.setLastError('quota');
          } else if (result?.error === 'offline') {
            blocked = 'offline';
            this.setLastError('offline');
          } else if (result?.error === 'timeout') {
            blocked = 'timeout';
            this.setLastError('timeout');
          } else if (result?.error === 'not_configured') {
            blocked = 'not_configured';
            this.setLastError('not_configured');
          } else {
            failed += 1;
            this.setLastError('failed');
          }
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
      if (done > 0 && !blocked && !late) this.setLastError(null);
      await this.persist();
      this.emit();
    } finally {
      this.running = false;
    }
    return { done, failed, blocked };
  }

  async processUntilIdle(): Promise<{ done: number; failed: number; blocked: string | null }> {
    await this.ensureLoaded();
    if (this.pumping) {
      this.pumpQueued = true;
      return { done: 0, failed: 0, blocked: null };
    }
    this.pumping = true;
    let done = 0;
    let failed = 0;
    let blocked: string | null = null;
    try {
      do {
        this.pumpQueued = false;
        const generation = this.runGeneration;
        blocked = null;
        while (generation === this.runGeneration) {
          const result = await this.processNext(BATCH);
          done += result.done;
          failed += result.failed;
          if (result.blocked) {
            blocked = result.blocked;
            this.pumpQueued = false;
            break;
          }
          if (result.done === 0 && result.failed === 0) break;
        }
      } while (this.pumpQueued);
    } finally {
      this.pumping = false;
      this.emit();
    }
    return { done, failed, blocked };
  }

  resetForTests(): void {
    this.snapshot = emptySnapshot();
    this.running = false;
    this.pumping = false;
    this.pumpQueued = false;
    this.cancelled = false;
    this.runGeneration = 0;
    this.lastError = null;
    this.policy = { catchup: true, import: true };
    this.provider = defaultPgnTranslationProvider;
  }

  private async restoreInFlight(
    queued: PgnTranslationJob[],
    generation: number,
  ): Promise<void> {
    const now = new Date().toISOString();
    const jobs = { ...this.snapshot!.jobs };
    const paused = generation !== this.runGeneration;
    for (const job of queued) {
      const current = jobs[job.id];
      if (!current || current.status === 'done') continue;
      jobs[job.id] = {
        ...current,
        status: paused || current.status === 'paused' ? 'paused' : 'queued',
        updatedAt: now,
      };
    }
    this.snapshot = { version: 1, jobs };
    await this.persist();
  }

  private async persist(): Promise<void> {
    if (!this.snapshot) return;
    await this.storage.setItem(KEY, JSON.stringify(this.snapshot));
    this.emit();
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
