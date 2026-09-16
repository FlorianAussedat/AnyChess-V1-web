import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { chessCultureQuestionKey } from './quizEngine.ts';
import type { ChessCultureQuestion } from './types.ts';

type History = { version: 1; seen: string[] };
const KEY = StorageKeys.chessCultureHistory.key;
const LIMIT = 2000;

function validate(value: unknown): History | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<History>;
  if (
    candidate.version !== 1 ||
    !Array.isArray(candidate.seen) ||
    !candidate.seen.every((key) => typeof key === 'string')
  )
    return null;
  return { version: 1, seen: [...new Set(candidate.seen)].slice(-LIMIT) };
}

/** Only displayed questions are remembered; abandoned unseen session items stay new. */
export class QuizHistoryStore {
  private writes: Promise<void> = Promise.resolve();
  private storage: KeyValueStorage;
  constructor(storage: KeyValueStorage = defaultKeyValueStorage) {
    this.storage = storage;
  }

  async getSeenKeys(): Promise<string[]> {
    await this.writes;
    return (
      await loadStoredJson<History>(
        this.storage,
        KEY,
        { version: 1, seen: [] },
        validate,
      )
    ).value.seen;
  }

  markSeen(
    question: Pick<ChessCultureQuestion, 'id' | 'revision'>,
  ): Promise<void> {
    const key = chessCultureQuestionKey(question);
    const write = this.writes.then(async () => {
      const loaded = await loadStoredJson<History>(
        this.storage,
        KEY,
        { version: 1, seen: [] },
        validate,
      );
      // Preserve a corrupt primary value for recovery, as required by shared storage policy.
      if (loaded.status === 'corrupt') return;
      const seen = [
        ...loaded.value.seen.filter((item) => item !== key),
        key,
      ].slice(-LIMIT);
      await this.storage.setItem(KEY, JSON.stringify({ version: 1, seen }));
    });
    this.writes = write.catch(() => {});
    return write;
  }
}

export const quizHistoryStore = new QuizHistoryStore();

