import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { commentAnchorKey } from './collectComments.ts';
import { fingerprintComment, translationRecordId } from './fingerprint.ts';
import type {
  PgnCommentAnchor,
  PgnCommentTranslationRecord,
  PgnTranslationSnapshot,
  PgnTranslationStatus,
} from './types.ts';

const KEY = StorageKeys.pgnCommentTranslations.key;

function emptySnapshot(): PgnTranslationSnapshot {
  return { version: 1, records: {} };
}

function validate(parsed: unknown): PgnTranslationSnapshot | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const row = parsed as { version?: unknown; records?: unknown };
  if (row.version !== 1) return null;
  if (!row.records || typeof row.records !== 'object' || Array.isArray(row.records)) return null;
  return { version: 1, records: { ...(row.records as PgnTranslationSnapshot['records']) } };
}

export class PgnCommentTranslationStore {
  private snapshot: PgnTranslationSnapshot | null = null;
  private readonly listeners = new Set<() => void>();
  private readonly storage: KeyValueStorage;

  constructor(storage: KeyValueStorage) {
    this.storage = storage;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }

  async ensureLoaded(): Promise<PgnTranslationSnapshot> {
    if (this.snapshot) return this.snapshot;
    const result = await loadStoredJson(this.storage, KEY, emptySnapshot(), validate);
    this.snapshot = result.value;
    return this.snapshot;
  }

  getSnapshot(): PgnTranslationSnapshot {
    return this.snapshot ?? emptySnapshot();
  }

  getRecord(anchor: PgnCommentAnchor): PgnCommentTranslationRecord | undefined {
    return this.getSnapshot().records[commentAnchorKey(anchor)];
  }

  resolveFrench(anchor: PgnCommentAnchor, original: string): PgnCommentTranslationRecord | null {
    const rec = this.getRecord(anchor);
    if (!rec) return null;
    if (rec.originalFingerprint !== fingerprintComment(original)) {
      return rec.status === 'manual' ? { ...rec, status: 'stale' } : { ...rec, status: 'stale' };
    }
    return rec;
  }

  async upsert(
    record: Omit<PgnCommentTranslationRecord, 'id' | 'updatedAt'> & {
      updatedAt?: string;
    },
  ): Promise<PgnCommentTranslationRecord> {
    await this.ensureLoaded();
    const id = translationRecordId(
      record.anchor.fileId,
      record.anchor.gameIndex,
      record.anchor.nodeId,
      record.anchor.slot,
    );
    const next: PgnCommentTranslationRecord = {
      ...record,
      id,
      updatedAt: record.updatedAt ?? new Date().toISOString(),
    };
    this.snapshot = {
      version: 1,
      records: { ...this.snapshot!.records, [commentAnchorKey(record.anchor)]: next },
    };
    await this.persist();
    this.emit();
    return next;
  }

  async saveManual(anchor: PgnCommentAnchor, original: string, french: string): Promise<void> {
    const prev = this.getRecord(anchor);
    await this.upsert({
      anchor,
      sourceLang: prev?.sourceLang ?? 'en',
      targetLang: 'fr',
      originalFingerprint: fingerprintComment(original),
      originalText: original,
      translatedText: french,
      status: 'manual',
      method: 'manual',
      previousManualText: prev?.method === 'manual' ? prev.translatedText : prev?.previousManualText,
    });
  }

  async markStale(anchor: PgnCommentAnchor): Promise<void> {
    const rec = this.getRecord(anchor);
    if (!rec || rec.status === 'stale') return;
    await this.upsert({ ...rec, status: 'stale' });
  }

  async pruneFile(source: PgnCommentAnchor['source'], fileId: string): Promise<void> {
    await this.ensureLoaded();
    const prefix = `${source}:${fileId}:`;
    const records = { ...this.snapshot!.records };
    let changed = false;
    for (const key of Object.keys(records)) {
      if (key.startsWith(prefix)) {
        delete records[key];
        changed = true;
      }
    }
    if (!changed) return;
    this.snapshot = { version: 1, records };
    await this.persist();
    this.emit();
  }

  fileStatus(
    source: PgnCommentAnchor['source'],
    fileId: string,
    englishCount: number,
  ): PgnTranslationStatus | 'none' {
    const records = Object.values(this.getSnapshot().records).filter(
      (r) => r.anchor.source === source && r.anchor.fileId === fileId,
    );
    if (englishCount === 0) return 'none';
    const ready = records.filter(
      (r) => (r.status === 'ready' || r.status === 'manual') && Boolean(r.translatedText?.trim()),
    );
    if (ready.length === 0) return records.some((r) => r.status === 'failed') ? 'failed' : 'pending';
    if (ready.length < englishCount) return 'stale';
    return ready.some((r) => r.method === 'manual') ? 'manual' : 'ready';
  }

  resetForTests(): void {
    this.snapshot = emptySnapshot();
  }

  private async persist(): Promise<void> {
    if (!this.snapshot) return;
    await this.storage.setItem(KEY, JSON.stringify(this.snapshot));
  }
}

export const pgnCommentTranslationStore = new PgnCommentTranslationStore(
  defaultKeyValueStorage,
);
