/**
 * Local device quality feedback for chess-culture questions.
 * Uses the shared AnyChess KeyValueStorage stack — not raw AsyncStorage.
 */
import type { KeyValueStorage } from '../storage/KeyValueStorage.ts';
import { defaultKeyValueStorage } from '../storage/AsyncKeyValueStorage.ts';
import { StorageKeys } from '../storage/StorageKeys.ts';
import { loadStoredJson } from '../storage/safeParse.ts';
import { CHESS_CULTURE_QUESTIONS } from './questions.ts';
import {
  emptyChessCultureFeedbackSnapshot,
  reconcileFeedbackWithQuestionRevision,
  replacePresentationFeedback,
} from './quizEngine.ts';
import type {
  ChessCultureFeedbackSnapshot,
  ChessCultureFeedbackVote,
  ChessCultureQuestion,
  ChessCultureQuestionFeedback,
} from './types.ts';

export const CHESS_CULTURE_FEEDBACK_STORAGE_KEY = StorageKeys.chessCultureFeedback.key;

function isFeedbackStatus(value: unknown): value is ChessCultureQuestionFeedback['status'] {
  return value === 'normal' || value === 'validated' || value === 'blacklisted';
}

export function validateChessCultureFeedbackSnapshot(
  parsed: unknown,
): ChessCultureFeedbackSnapshot | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const p = parsed as Partial<ChessCultureFeedbackSnapshot>;
  if (p.version !== 1) return null;
  if (!p.questions || typeof p.questions !== 'object' || Array.isArray(p.questions)) {
    return null;
  }

  const questions: Record<string, ChessCultureQuestionFeedback> = {};
  for (const [id, raw] of Object.entries(p.questions)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const fb = raw as Partial<ChessCultureQuestionFeedback>;
    if (typeof fb.questionId !== 'string') continue;
    if (typeof fb.questionRevision !== 'number' || fb.questionRevision < 1) continue;
    if (typeof fb.upVotes !== 'number' || fb.upVotes < 0) continue;
    if (typeof fb.downVotes !== 'number' || fb.downVotes < 0) continue;
    if (!isFeedbackStatus(fb.status)) continue;
    questions[id] = {
      questionId: fb.questionId,
      questionRevision: fb.questionRevision,
      upVotes: Math.floor(fb.upVotes),
      downVotes: Math.floor(fb.downVotes),
      status: fb.status,
      lastFeedbackAt:
        typeof fb.lastFeedbackAt === 'string' ? fb.lastFeedbackAt : undefined,
    };
  }

  return { version: 1, questions };
}

/**
 * Reconcile stored feedback against current source revisions.
 * Stale (older revision) entries are reset so corrected questions re-enter the pool.
 */
export function reconcileFeedbackSnapshotWithQuestions(
  snapshot: ChessCultureFeedbackSnapshot,
  questions: readonly ChessCultureQuestion[] = CHESS_CULTURE_QUESTIONS,
): ChessCultureFeedbackSnapshot {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const next: Record<string, ChessCultureQuestionFeedback> = {};

  for (const [id, feedback] of Object.entries(snapshot.questions)) {
    const question = byId.get(id);
    if (!question) {
      next[id] = { ...feedback };
      continue;
    }
    next[id] = reconcileFeedbackWithQuestionRevision(feedback, question);
  }

  return { version: 1, questions: next };
}

export class QuestionFeedbackStore {
  private readonly storage: KeyValueStorage;
  private readonly key: string;

  constructor(
    storage: KeyValueStorage = defaultKeyValueStorage,
    key: string = CHESS_CULTURE_FEEDBACK_STORAGE_KEY,
  ) {
    this.storage = storage;
    this.key = key;
  }

  async getSnapshot(): Promise<ChessCultureFeedbackSnapshot> {
    const result = await loadStoredJson(
      this.storage,
      this.key,
      emptyChessCultureFeedbackSnapshot(),
      validateChessCultureFeedbackSnapshot,
    );
    return reconcileFeedbackSnapshotWithQuestions(result.value);
  }

  async saveSnapshot(snapshot: ChessCultureFeedbackSnapshot): Promise<void> {
    await this.storage.setItem(this.key, JSON.stringify(snapshot));
  }

  /**
   * Persist a single presentation vote.
   * Pass `snapshotBeforePresentation` so switching 👍↔👎 on the same screen
   * replaces the presentation vote instead of stacking counts.
   */
  async submitPresentationVote(
    question: Pick<ChessCultureQuestion, 'id' | 'revision'>,
    vote: ChessCultureFeedbackVote,
    snapshotBeforePresentation: ChessCultureFeedbackSnapshot,
    nowIso: string = new Date().toISOString(),
  ): Promise<ChessCultureFeedbackSnapshot> {
    const next = replacePresentationFeedback(
      snapshotBeforePresentation,
      question,
      vote,
      nowIso,
    );
    await this.saveSnapshot(next);
    return next;
  }

  async getBlacklistedQuestionIds(
    questions: readonly ChessCultureQuestion[] = CHESS_CULTURE_QUESTIONS,
  ): Promise<string[]> {
    const snapshot = await this.getSnapshot();
    return getBlacklistedChessCultureQuestionIds(snapshot, questions);
  }

  async resetAll(): Promise<void> {
    await this.storage.removeItem(this.key);
  }
}

export const questionFeedbackStore = new QuestionFeedbackStore();

/** Developer diagnostic: blacklisted IDs for the current source + local feedback. */
export function getBlacklistedChessCultureQuestionIds(
  snapshot: ChessCultureFeedbackSnapshot,
  questions: readonly ChessCultureQuestion[] = CHESS_CULTURE_QUESTIONS,
): string[] {
  const reconciled = reconcileFeedbackSnapshotWithQuestions(snapshot, questions);
  return Object.values(reconciled.questions)
    .filter((fb) => fb.status === 'blacklisted')
    .map((fb) => fb.questionId)
    .sort();
}

export async function getChessCultureFeedbackSnapshot(
  store: QuestionFeedbackStore = questionFeedbackStore,
): Promise<ChessCultureFeedbackSnapshot> {
  return store.getSnapshot();
}
