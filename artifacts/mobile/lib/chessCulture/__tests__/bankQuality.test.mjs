import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
import {
  matingMoves,
  playUci,
  uci,
} from '../../../scripts/quiz-quality/mateProof.mjs';

const normalized = (text) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
describe('curated bank editorial and diagram contracts', () => {
  it('contains 500 distinct prompts/visuals and four distinct choices each', () => {
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
    assert.equal(prompts.size, 500);
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

  it('replays all 50 opening sequences to the displayed FEN', () => {
    const openings = bank.filter((q) => q.verification?.kind === 'opening');
    assert.equal(openings.length, 50);
    const unique = new Set();
    for (const q of openings) {
      const board = new Chess();
      for (const move of q.verification.moves) board.move(move);
      assert.equal(board.fen(), q.presentation.boardFen, q.id);
      const position = board.fen().split(' ').slice(0, 4).join(' ');
      assert.ok(!unique.has(position), q.id);
      unique.add(position);
    }
  });

  it('proves unique forced mates against every legal defence, including all distractors', () => {
    const puzzles = JSON.parse(
      fs.readFileSync(
        new URL('../../puzzles/data/puzzles.json', import.meta.url),
        'utf8',
      ),
    );
    const positions = bank.filter((q) => q.verification?.kind === 'mate');
    assert.equal(positions.length, 80);
    assert.equal(
      positions.filter((q) => q.verification.movesToMate === 1).length,
      40,
    );
    for (const q of positions) {
      const v = q.verification;
      const board = new Chess(q.presentation.boardFen);
      const source = puzzles.find((p) => p.id === v.puzzleId);
      assert.ok(source, q.id);
      const setup = new Chess(source.fen);
      playUci(setup, source.moves[0]);
      assert.equal(setup.fen(), board.fen(), q.id);
      const legal = new Set(board.moves({ verbose: true }).map(uci));
      for (const move of v.answerMoves)
        assert.ok(legal.has(move), `${q.id}: illegal distractor ${move}`);
      const winners = matingMoves(board, v.movesToMate);
      assert.deepEqual(
        winners,
        [v.answerMoves[q.correctAnswer]],
        `${q.id}: missing or ambiguous mate`,
      );
      if (v.movesToMate === 2)
        assert.deepEqual(
          matingMoves(board, 1),
          [],
          `${q.id}: actually mate in one`,
        );
      for (const move of v.principalLine) playUci(board, move);
      assert.equal(
        board.isCheckmate(),
        true,
        `${q.id}: explanation line must mate`,
      );
    }
  });
});

describe('question rotation and persistence', () => {
  it('exhausts the full bank before repeating even across 50 sessions', () => {
    const seen = [];
    const ids = new Set();
    for (let i = 0; i < 50; i++) {
      const session = createChessCultureQuizSession(bank, 10, () => 0.42, seen);
      assert.equal(session.length, 10);
      for (const { question: q } of session) {
        assert.ok(!ids.has(q.id), `early repeat ${q.id}`);
        ids.add(q.id);
        seen.push(chessCultureQuestionKey(q));
      }
    }
    assert.equal(ids.size, 500);
    const next = createChessCultureQuizSession(bank, 10, () => 0.42, seen);
    assert.deepEqual(
      next.map((x) => chessCultureQuestionKey(x.question)),
      seen.slice(0, 10),
    );
  });

  it('spreads a fresh session over ten categories', () => {
    const session = createChessCultureQuizSession(bank, 10, () => 0.42);
    assert.equal(new Set(session.map((x) => x.question.category)).size, 10);
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

