import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { CHESS_CULTURE_QUESTIONS as bank } from '../questions.ts';
import { QuizHistoryStore } from '../QuizHistoryStore.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  chessCultureQuestionKey,
  createChessCultureQuizSession,
  validateChessCultureQuestion,
} from '../quizEngine.ts';

const normalized = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
describe('curated bank editorial and diagram contracts', () => {
  it('contains 213 distinct prompts and four distinct choices each', () => {
    const prompts = new Set();
    for (const q of bank) {
      const key = [
        normalized(q.question),
        q.presentation?.boardFen?.split(' ').slice(0, 4).join(' ') ?? '',
        q.presentation?.imageId ?? '',
      ].join('|');
      assert.ok(!prompts.has(key), `duplicate ${q.id}`);
      prompts.add(key);
      assert.equal(new Set(q.answers.map(normalized)).size, 4, q.id);
      if (q.i18nEn)
        assert.equal(new Set(q.i18nEn.answers.map(normalized)).size, 4, q.id);
    }
    assert.equal(prompts.size, 213);
  });

  it('removes the incorrect and trivial legacy examples', () => {
    for (const id of [
      'visual-014',
      'visual-016',
      'modern-005',
      'rules-001',
      'rules-013',
      'chess-culture-006',
    ]) {
      assert.ok(!bank.some((q) => q.id === id), id);
    }
    assert.match(
      bank.find((q) => q.id === 'famous-games-002').question,
      /champion du monde/,
    );
    assert.match(
      bank.find((q) => q.id === 'modern-013').question,
      /Grand Swiss/,
    );
    assert.ok(bank.find((q) => q.id === 'famous-games-002').revision > 1);
  });

  it('does not reveal player names through photo alt text', () => {
    for (const q of bank.filter((q) => q.id.startsWith('player-photo-'))) {
      assert.ok(
        !normalized(q.presentation.imageAlt).includes(
          normalized(q.answers[q.correctAnswer]),
        ),
        q.id,
      );
    }
  });

  it('rejects duplicate answer labels', () => {
    assert.ok(
      validateChessCultureQuestion({
        ...bank[0],
        answers: ['Same', 'same ', 'C', 'D'],
      }).some((e) => e.message.includes('distinct')),
    );
  });

  it('uses legal side-to-move states and explicit turn labels for every board', () => {
    for (const q of bank.filter((q) => q.presentation?.boardFen)) {
      const fen = q.presentation.boardFen;
      const board = new Chess(fen);
      assert.match(
        q.question,
        board.turn() === 'w' ? /^Trait aux Blancs/ : /^Trait aux Noirs/,
        q.id,
      );
      const fields = fen.split(' ');
      fields[1] = board.turn() === 'w' ? 'b' : 'w';
      fields[3] = '-';
      // The player who just moved cannot have left their own king in check.
      assert.equal(new Chess(fields.join(' ')).isCheck(), false, q.id);
      assert.equal(board.isGameOver(), false, q.id);
    }
  });

  it('no longer includes opening-recognition or mate-solving exercises', () => {
    assert.equal(
      bank.filter((q) => q.verification?.kind === 'opening').length,
      0,
    );
    assert.equal(bank.filter((q) => q.verification?.kind === 'mate').length, 0);
    assert.equal(
      bank.filter((q) => q.id.startsWith('openingPlans-review-')).length,
      0,
    );
    assert.equal(bank.filter((q) => q.id.startsWith('strategy-review-')).length, 0);
    assert.equal(bank.filter((q) => q.id.startsWith('opening-board-')).length, 0);
    assert.equal(bank.filter((q) => q.id.startsWith('position-mate-')).length, 0);
    const keptEndgames = bank.filter((q) => q.id.startsWith('endgames-review-'));
    assert.equal(keptEndgames.length, 13);
    assert.deepEqual(
      keptEndgames.map((q) => q.id).sort(),
      [
        'endgames-review-003',
        'endgames-review-004',
        'endgames-review-010',
        'endgames-review-011',
        'endgames-review-013',
        'endgames-review-017',
        'endgames-review-021',
        'endgames-review-022',
        'endgames-review-026',
        'endgames-review-051',
        'endgames-review-052',
        'endgames-review-056',
        'endgames-review-059',
      ],
    );
  });
});

describe('question rotation and persistence', () => {
  it('exhausts the full bank before repeating', () => {
    const seen = [];
    const ids = new Set();
    while (ids.size < bank.length) {
      const session = createChessCultureQuizSession(bank, 10, () => 0.42, seen);
      assert.ok(session.length > 0);
      for (const { question: q } of session) {
        if (!ids.has(q.id)) {
          ids.add(q.id);
        } else {
          assert.equal(ids.size, bank.length, `early repeat ${q.id}`);
        }
        seen.push(chessCultureQuestionKey(q));
      }
    }
    assert.equal(ids.size, 213);
    const next = createChessCultureQuizSession(bank, 10, () => 0.42, seen);
    assert.equal(next.length, 10);
    assert.ok(
      next.every((x) => ids.has(x.question.id)),
      'after exhaustion the next session only repeats known questions',
    );
  });

  it('spreads a fresh session across remaining culture categories', () => {
    const session = createChessCultureQuizSession(bank, 10, () => 0.42);
    const categories = new Set(session.map((x) => x.question.category));
    assert.equal(categories.size, 10);
  });

  it('gives corrected revisions a new chance without breaking feedback identity', () => {
    const q = bank[0];
    const updated = { ...q, revision: q.revision + 1 };
    const seen = [chessCultureQuestionKey(q), chessCultureQuestionKey(bank[1])];
    assert.equal(
      createChessCultureQuizSession([updated, bank[1]], 1, () => 0.1, seen)[0]
        .question.id,
      q.id,
    );
  });

  it('remembers only displayed items, persists across instances and serializes rapid writes', async () => {
    const storage = new MemoryKeyValueStorage();
    const history = new QuizHistoryStore(storage);
    const session = createChessCultureQuizSession(bank, 10, () => 0.42);
    await Promise.all(
      session.slice(0, 3).map((x) => history.markSeen(x.question)),
    );
    const reopened = new QuizHistoryStore(storage);
    const keys = await reopened.getSeenKeys();
    assert.deepEqual(
      keys,
      session.slice(0, 3).map((x) => chessCultureQuestionKey(x.question)),
    );
    const next = createChessCultureQuizSession(bank, 10, () => 0.42, keys);
    assert.ok(
      next.every((x) => !keys.includes(chessCultureQuestionKey(x.question))),
    );
    await reopened.markSeen(session[0].question);
    assert.equal((await reopened.getSeenKeys()).length, 3);
  });

  it('preserves corrupt primary storage instead of overwriting it', async () => {
    const storage = new MemoryKeyValueStorage();
    const key = StorageKeys.chessCultureHistory.key;
    await storage.setItem(key, '{broken');
    const history = new QuizHistoryStore(storage);
    assert.deepEqual(await history.getSeenKeys(), []);
    await history.markSeen(bank[0]);
    assert.equal(await storage.getItem(key), '{broken');
  });
});

