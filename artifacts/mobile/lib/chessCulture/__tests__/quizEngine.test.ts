import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { CHESS_CULTURE_QUESTIONS } from '../questions.ts';
import {
  applyQuestionFeedback,
  boardFromFen,
  calculateChessCultureScore,
  createChessCultureQuizSession,
  emptyChessCultureFeedbackSnapshot,
  getActiveChessCultureQuestions,
  getEligibleChessCultureQuestions,
  isValidChessFen,
  reconcileFeedbackWithQuestionRevision,
  replacePresentationFeedback,
  shouldBlacklistQuestion,
  validateChessCultureQuestion,
  validateChessCultureQuestionBank,
} from '../quizEngine.ts';
import {
  localizeChessCultureQuestion,
  localizeChessCultureQuestions,
} from '../localizeQuestion.ts';
import {
  QuestionFeedbackStore,
  CHESS_CULTURE_FEEDBACK_STORAGE_KEY,
  getBlacklistedChessCultureQuestionIds,
  reconcileFeedbackSnapshotWithQuestions,
  validateChessCultureFeedbackSnapshot,
} from '../QuestionFeedbackStore.ts';
import {
  listChessCultureImageIds,
  resolveChessCultureImageSource,
} from '../visualRegistry.ts';
import type { ChessCultureQuestion } from '../types.ts';

function sampleQuestion(
  overrides: Partial<ChessCultureQuestion> & Pick<ChessCultureQuestion, 'id'>,
): ChessCultureQuestion {
  return {
    revision: 1,
    question: 'Sample?',
    answers: ['A', 'B', 'C', 'D'],
    correctAnswer: 0,
    explanation: 'Because A.',
    category: 'other',
    difficulty: 1,
    tags: ['sample'],
    sourceType: 'stable-fact',
    active: true,
    ...overrides,
  };
}

describe('chessCulture question bank', () => {
  it('contains at least 180 questions with unique ids', () => {
    assert.ok(CHESS_CULTURE_QUESTIONS.length >= 180);
    const ids = CHESS_CULTURE_QUESTIONS.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('has a large active bank with practical category coverage', () => {
    const active = CHESS_CULTURE_QUESTIONS.filter((q) => q.active === true);
    assert.equal(active.length, CHESS_CULTURE_QUESTIONS.length);
    assert.ok(active.length >= 180);
    const categories = new Set(active.map((q) => q.category));
    for (const required of [
      'checkmates',
      'terminology',
      'visual',
      'modern-chess',
      'openings',
      'rules',
    ] as const) {
      assert.ok(categories.has(required), `missing category ${required}`);
    }
    assert.ok(active.filter((q) => q.category === 'checkmates').length >= 10);
    assert.ok(active.filter((q) => q.id.startsWith('terminology-new-')).length >= 20);
    assert.ok(active.filter((q) => q.category === 'visual').length >= 15);
    assert.ok(active.filter((q) => q.category === 'modern-chess').length >= 20);
    assert.ok(active.filter((q) => q.id.startsWith('openings-new-')).length >= 10);
    assert.ok(active.filter((q) => q.id.startsWith('rules-new-')).length >= 10);
  });

  it('passes schema validation including FEN questions', () => {
    const errors = validateChessCultureQuestionBank(CHESS_CULTURE_QUESTIONS, {
      knownImageIds: new Set(listChessCultureImageIds()),
    });
    assert.deepEqual(errors, []);
  });

  it('keeps FEN presentation questions valid', () => {
    const fenQs = CHESS_CULTURE_QUESTIONS.filter((q) => q.presentation?.boardFen);
    assert.ok(fenQs.length >= 15);
    for (const q of fenQs) {
      assert.deepEqual(validateChessCultureQuestion(q), []);
      assert.equal(isValidChessFen(q.presentation!.boardFen!), true);
    }
  });

  it('assigns difficulty metadata in range 1..5', () => {
    for (const q of CHESS_CULTURE_QUESTIONS) {
      assert.ok(q.difficulty >= 1 && q.difficulty <= 5);
    }
  });

  it('keeps text-only questions valid without presentation', () => {
    const textOnly = CHESS_CULTURE_QUESTIONS.filter((q) => !q.presentation);
    assert.ok(textOnly.length >= 1);
    assert.deepEqual(validateChessCultureQuestion(textOnly[0]!), []);
  });

  it('provides bilingual copy for the practical expansion modules', () => {
    const expansion = CHESS_CULTURE_QUESTIONS.filter(
      (q) =>
        q.id.startsWith('checkmates-') ||
        q.id.startsWith('terminology-new-') ||
        q.id.startsWith('visual-') ||
        q.id.startsWith('modern-') ||
        q.id.startsWith('openings-new-') ||
        q.id.startsWith('rules-new-'),
    );
    assert.ok(expansion.length >= 90);
    for (const q of expansion) {
      assert.ok(q.i18nEn, `missing i18nEn for ${q.id}`);
      assert.ok(q.i18nEn!.question.trim().length > 0);
      assert.equal(q.i18nEn!.answers.length, 4);
      assert.ok(q.i18nEn!.explanation.trim().length > 0);
    }
  });

  it('does not mutate source question objects when building a session', () => {
    const frozen = CHESS_CULTURE_QUESTIONS.map((q) => ({
      ...q,
      answers: [...q.answers] as [string, string, string, string],
      tags: [...q.tags],
    }));
    const before = JSON.stringify(frozen[0]);
    const session = createChessCultureQuizSession(frozen, 10, () => 0.42);
    assert.ok(session.length > 0);
    assert.equal(JSON.stringify(frozen[0]), before);
    assert.equal(frozen[0]!.answers[0], CHESS_CULTURE_QUESTIONS[0]!.answers[0]);
  });
});

describe('chessCulture localization', () => {
  it('returns French canonical text when language is fr', () => {
    const q = CHESS_CULTURE_QUESTIONS.find((item) => item.id === 'checkmates-001');
    assert.ok(q?.i18nEn);
    const localized = localizeChessCultureQuestion(q!, 'fr');
    assert.equal(localized.question, q!.question);
    assert.equal(localized.explanation, q!.explanation);
  });

  it('swaps EN copy without mutating the source question', () => {
    const q = CHESS_CULTURE_QUESTIONS.find((item) => item.id === 'checkmates-001');
    assert.ok(q?.i18nEn);
    const before = JSON.stringify(q);
    const localized = localizeChessCultureQuestion(q!, 'en');
    assert.equal(localized.question, q!.i18nEn!.question);
    assert.deepEqual(localized.answers, q!.i18nEn!.answers);
    assert.equal(localized.explanation, q!.i18nEn!.explanation);
    assert.equal(JSON.stringify(q), before);
  });

  it('localizes a bank for an English session while preserving ids', () => {
    const sample = CHESS_CULTURE_QUESTIONS.filter((q) => q.i18nEn).slice(0, 5);
    const localized = localizeChessCultureQuestions(sample, 'en');
    assert.equal(localized.length, sample.length);
    for (let i = 0; i < sample.length; i += 1) {
      assert.equal(localized[i]!.id, sample[i]!.id);
      assert.equal(localized[i]!.question, sample[i]!.i18nEn!.question);
    }
  });
});

describe('chessCulture quiz engine', () => {
  it('returns only active questions', () => {
    const bank = [
      sampleQuestion({ id: 'a', active: true }),
      sampleQuestion({ id: 'b', active: false }),
      sampleQuestion({ id: 'c', active: true }),
    ];
    const active = getActiveChessCultureQuestions(bank);
    assert.deepEqual(
      active.map((q) => q.id),
      ['a', 'c'],
    );
  });

  it('builds a 10-question session with no duplicate ids', () => {
    const session = createChessCultureQuizSession(
      getActiveChessCultureQuestions(CHESS_CULTURE_QUESTIONS),
      10,
      () => 0.3,
    );
    assert.equal(session.length, 10);
    const ids = session.map((s) => s.question.id);
    assert.equal(new Set(ids).size, 10);
  });

  it('respects requested count and handles a smaller database', () => {
    const bank = [
      sampleQuestion({ id: 'x1' }),
      sampleQuestion({ id: 'x2' }),
      sampleQuestion({ id: 'x3' }),
    ];
    const session = createChessCultureQuizSession(bank, 10, () => 0.5);
    assert.equal(session.length, 3);
  });

  it('calculates score and percentage', () => {
    assert.deepEqual(calculateChessCultureScore(8, 10), {
      correct: 8,
      total: 10,
      percentage: 80,
    });
    assert.deepEqual(calculateChessCultureScore(0, 0), {
      correct: 0,
      total: 0,
      percentage: 0,
    });
  });

  it('keeps the correct answer association after answer shuffling', () => {
    const q = sampleQuestion({
      id: 'shuffle-1',
      answers: ['Right', 'W1', 'W2', 'W3'],
      correctAnswer: 0,
    });
    // Deterministic random that still permutes.
    let n = 0;
    const random = () => {
      n += 1;
      return (n % 7) / 7;
    };
    const [sessionQ] = createChessCultureQuizSession([q], 1, random);
    assert.ok(sessionQ);
    assert.equal(
      sessionQ.displayAnswers[sessionQ.correctDisplayIndex],
      'Right',
    );
    assert.equal(q.answers[0], 'Right');
  });

  it('excludes blacklisted questions from eligible sessions', () => {
    const bank = [
      sampleQuestion({ id: 'keep', revision: 1 }),
      sampleQuestion({ id: 'drop', revision: 1 }),
    ];
    const feedback = emptyChessCultureFeedbackSnapshot();
    feedback.questions.drop = {
      questionId: 'drop',
      questionRevision: 1,
      upVotes: 0,
      downVotes: 3,
      status: 'blacklisted',
    };
    const eligible = getEligibleChessCultureQuestions(bank, feedback);
    assert.deepEqual(
      eligible.map((q) => q.id),
      ['keep'],
    );
  });
});

describe('chessCulture quality feedback', () => {
  it('blacklists after three negative votes', () => {
    const q = sampleQuestion({ id: 'hist-1', revision: 1 });
    let snap = emptyChessCultureFeedbackSnapshot();
    snap = applyQuestionFeedback(snap, q, 'down', '2020-01-01T00:00:00.000Z');
    assert.equal(snap.questions['hist-1']!.downVotes, 1);
    assert.equal(snap.questions['hist-1']!.status, 'normal');
    snap = applyQuestionFeedback(snap, q, 'down', '2020-01-02T00:00:00.000Z');
    assert.equal(snap.questions['hist-1']!.downVotes, 2);
    snap = applyQuestionFeedback(snap, q, 'down', '2020-01-03T00:00:00.000Z');
    assert.equal(snap.questions['hist-1']!.downVotes, 3);
    assert.equal(snap.questions['hist-1']!.status, 'blacklisted');
    assert.equal(shouldBlacklistQuestion(3), true);
  });

  it('one presentation vote is replaceable without stacking', () => {
    const q = sampleQuestion({ id: 'p-1', revision: 1 });
    const base = emptyChessCultureFeedbackSnapshot();
    const up = replacePresentationFeedback(base, q, 'up', 't1');
    assert.equal(up.questions['p-1']!.upVotes, 1);
    assert.equal(up.questions['p-1']!.downVotes, 0);
    const switched = replacePresentationFeedback(base, q, 'down', 't2');
    assert.equal(switched.questions['p-1']!.upVotes, 0);
    assert.equal(switched.questions['p-1']!.downVotes, 1);
    assert.equal(switched.questions['p-1']!.status, 'normal');
  });

  it('thumbs-up does not erase historical downVotes', () => {
    const q = sampleQuestion({ id: 'mix-1', revision: 1 });
    let snap = emptyChessCultureFeedbackSnapshot();
    snap = applyQuestionFeedback(snap, q, 'down');
    snap = applyQuestionFeedback(snap, q, 'down');
    snap = applyQuestionFeedback(snap, q, 'up');
    assert.equal(snap.questions['mix-1']!.downVotes, 2);
    assert.equal(snap.questions['mix-1']!.upVotes, 1);
    assert.equal(snap.questions['mix-1']!.status, 'validated');
  });

  it('wrong quiz answers do not affect quality feedback', () => {
    const snap = emptyChessCultureFeedbackSnapshot();
    // Simulating a wrong answer has no API on the feedback layer — snapshot stays empty.
    assert.deepEqual(snap.questions, {});
    const score = calculateChessCultureScore(0, 1);
    assert.equal(score.correct, 0);
    assert.deepEqual(snap.questions, {});
  });

  it('revision change resets old feedback', () => {
    const old = reconcileFeedbackWithQuestionRevision(
      {
        questionId: 'history-023',
        questionRevision: 1,
        upVotes: 0,
        downVotes: 3,
        status: 'blacklisted',
      },
      { id: 'history-023', revision: 2 },
    );
    assert.deepEqual(old, {
      questionId: 'history-023',
      questionRevision: 2,
      upVotes: 0,
      downVotes: 0,
      status: 'normal',
    });
  });

  it('reconciled blacklisted ids are identifiable for developers', () => {
    const bank = [
      sampleQuestion({ id: 'history-023', revision: 1 }),
      sampleQuestion({ id: 'rules-014', revision: 1 }),
    ];
    const snap = emptyChessCultureFeedbackSnapshot();
    snap.questions['history-023'] = {
      questionId: 'history-023',
      questionRevision: 1,
      upVotes: 0,
      downVotes: 3,
      status: 'blacklisted',
    };
    snap.questions['rules-014'] = {
      questionId: 'rules-014',
      questionRevision: 1,
      upVotes: 0,
      downVotes: 3,
      status: 'blacklisted',
    };
    assert.deepEqual(getBlacklistedChessCultureQuestionIds(snap, bank), [
      'history-023',
      'rules-014',
    ]);

    // Corrected revision clears blacklist.
    bank[0] = { ...bank[0]!, revision: 2 };
    const reconciled = reconcileFeedbackSnapshotWithQuestions(snap, bank);
    assert.equal(reconciled.questions['history-023']!.status, 'normal');
    assert.deepEqual(getBlacklistedChessCultureQuestionIds(reconciled, bank), [
      'rules-014',
    ]);
  });
});

describe('chessCulture feedback storage', () => {
  it('serializes and deserializes a stable snapshot', async () => {
    const storage = new MemoryKeyValueStorage();
    const store = new QuestionFeedbackStore(storage);
    const q = sampleQuestion({ id: 'store-1', revision: 1 });
    const base = emptyChessCultureFeedbackSnapshot();
    await store.submitPresentationVote(q, 'down', base, '2024-01-01T00:00:00.000Z');
    const loaded = await store.getSnapshot();
    assert.equal(loaded.version, 1);
    assert.equal(loaded.questions['store-1']!.downVotes, 1);

    const raw = await storage.getItem(CHESS_CULTURE_FEEDBACK_STORAGE_KEY);
    const again = validateChessCultureFeedbackSnapshot(JSON.parse(raw!));
    assert.ok(again);
    assert.equal(again!.questions['store-1']!.downVotes, 1);
  });
});

describe('chessCulture FEN helpers', () => {
  it('validates FEN with chess.js and builds a board matrix', () => {
    const fen = '4r2k/8/8/8/8/8/8/4K2R w K - 0 1';
    assert.equal(isValidChessFen(fen), true);
    assert.equal(isValidChessFen('not-a-fen'), false);
    const board = boardFromFen(fen);
    assert.equal(board.length, 8);
    assert.equal(board[7]![4]?.type, 'k');
  });

  it('rejects invalid FEN without throwing from isValidChessFen', () => {
    assert.equal(isValidChessFen('8/8/8/8/8/8/8/8 w - - 0 1'), false);
    assert.equal(isValidChessFen(''), false);
  });

  it('keeps bank validation resilient when a question has a bad FEN', () => {
    const broken = sampleQuestion({
      id: 'bad-fen-1',
      presentation: { boardFen: 'not-a-real-fen' },
    });
    const errors = validateChessCultureQuestion(broken);
    assert.ok(errors.some((e) => e.message.includes('boardFen')));
    // Valid neighbors still validate independently.
    const ok = CHESS_CULTURE_QUESTIONS.find((q) => q.presentation?.boardFen);
    assert.ok(ok);
    assert.deepEqual(validateChessCultureQuestion(ok!), []);
  });
});

describe('chessCulture optional visuals', () => {
  it('accepts a known registered imageId', () => {
    const q = sampleQuestion({
      id: 'players-050',
      presentation: {
        imageId: 'player-bobby-fischer',
        imageAlt: 'Portrait du joueur à identifier',
        imageFit: 'contain',
      },
    });
    const errors = validateChessCultureQuestion(q, 0, {
      knownImageIds: new Set(['player-bobby-fischer']),
    });
    assert.deepEqual(errors, []);
  });

  it('rejects an unknown imageId with question id in the message', () => {
    const q = sampleQuestion({
      id: 'players-050',
      presentation: {
        imageId: 'player-bobby-fischer',
        imageAlt: 'Portrait du joueur à identifier',
      },
    });
    const errors = validateChessCultureQuestion(q, 0, {
      knownImageIds: new Set(['player-garry-kasparov']),
    });
    assert.ok(
      errors.some(
        (e) =>
          e.id === 'players-050' &&
          e.message.includes('unknown imageId') &&
          e.message.includes('player-bobby-fischer'),
      ),
      JSON.stringify(errors),
    );
  });

  it('rejects invalid imageFit values', () => {
    const q = {
      ...sampleQuestion({ id: 'fit-1' }),
      presentation: {
        imageId: 'object-mechanical-chess-clock',
        imageFit: 'stretch',
      },
    };
    const errors = validateChessCultureQuestion(q, 0, {
      knownImageIds: new Set(['object-mechanical-chess-clock']),
    });
    assert.ok(errors.some((e) => e.message.includes('imageFit')));
  });

  it('does not let image metadata change answer randomization or mutate source', () => {
    const q = sampleQuestion({
      id: 'img-shuffle',
      answers: ['Right', 'W1', 'W2', 'W3'],
      correctAnswer: 0,
      presentation: {
        imageId: 'player-bobby-fischer',
        imageAlt: 'Portrait du joueur à identifier',
        imageCaption: 'Ne doit pas spoiler',
        imageFit: 'contain',
      },
    });
    const before = JSON.stringify(q);
    let n = 0;
    const random = () => {
      n += 1;
      return (n % 7) / 7;
    };
    const [sessionQ] = createChessCultureQuizSession([q], 1, random);
    assert.ok(sessionQ);
    assert.equal(sessionQ.displayAnswers[sessionQ.correctDisplayIndex], 'Right');
    assert.equal(JSON.stringify(q), before);
    assert.equal(q.presentation?.imageId, 'player-bobby-fischer');
  });

  it('does not let image metadata affect feedback or blacklist', () => {
    const q = sampleQuestion({
      id: 'img-fb',
      presentation: { imageId: 'player-bobby-fischer' },
    });
    let snap = emptyChessCultureFeedbackSnapshot();
    snap = applyQuestionFeedback(snap, q, 'down');
    snap = applyQuestionFeedback(snap, q, 'down');
    snap = applyQuestionFeedback(snap, q, 'down');
    assert.equal(snap.questions['img-fb']!.status, 'blacklisted');
    assert.equal(snap.questions['img-fb']!.downVotes, 3);
    const eligible = getEligibleChessCultureQuestions([q], snap);
    assert.deepEqual(eligible, []);
  });

  it('resolves missing images safely without throwing', () => {
    assert.equal(resolveChessCultureImageSource(undefined), null);
    assert.equal(resolveChessCultureImageSource(''), null);
    assert.equal(resolveChessCultureImageSource('does-not-exist'), null);
    assert.equal(
      resolveChessCultureImageSource('x', () => {
        throw new Error('boom');
      }),
      null,
    );
  });
});
