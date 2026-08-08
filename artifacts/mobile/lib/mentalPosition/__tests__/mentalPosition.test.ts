/**
 * Mental position — pure logic tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeHistory,
  buildQuestionPool,
  countDeveloped,
  generateQuestions,
  validatePositionAnswer,
  MentalPositionSession,
  generateMentalSequence,
  generateMentalSequenceWithQuestions,
  INSUFFICIENT_QUESTIONS_ERROR,
  MENTAL_MAX_QUESTIONS,
} from '../index.ts';

const ITALIAN_LINE = [
  'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4',
  'cxd4', 'Bb4+', 'Bd2', 'Bxd2+', 'Nbxd2', 'd5', 'exd5', 'Nfxd5',
];

const CAPTURE_LINE = ['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qa5'];

describe('analyzeHistory', () => {
  it('locates the white knight from g1 after Nf3', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const n = a.pieces.find((p) => p.startSquare === 'g1');
    assert.ok(n);
    assert.equal(n!.currentSquare, 'f3');
    assert.equal(n!.captured, false);
  });

  it('marks captured pieces and records capture history', () => {
    const a = analyzeHistory(['e4', 'd5', 'exd5']);
    const pawn = a.pieces.find((p) => p.startSquare === 'd7');
    assert.ok(pawn);
    assert.equal(pawn!.captured, true);
    assert.equal(a.captureHistory.length, 1);
    assert.equal(a.captureHistory[0].pieceType, 'p');
    assert.equal(a.captureHistory[0].color, 'b');
  });

  it('tracks white and black SAN arrays', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    assert.deepEqual(a.whiteSans, ['e4', 'Nf3']);
    assert.deepEqual(a.blackSans, ['e5', 'Nc6']);
  });

  it('records fen snapshots after each half-move', () => {
    const a = analyzeHistory(['e4', 'e5']);
    assert.equal(a.fenSnapshots.length, 2);
    assert.notEqual(a.fenSnapshots[0], a.fenSnapshots[1]);
    assert.match(a.fenSnapshots[0], / b /);
    assert.match(a.fenSnapshots[1], / w /);
  });

  it('tracks castling rights from final FEN', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    assert.equal(a.castlingRightsRemaining.whiteKing, true);
    assert.equal(a.castlingPlayed.length, 0);
  });

  it('records castling played', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Be7', 'O-O']);
    assert.equal(a.castlingPlayed.length, 1);
    assert.equal(a.castlingPlayed[0].color, 'w');
    assert.equal(a.castlingPlayed[0].side, 'kingside');
  });

  it('tracks move counts per piece id', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    const knight = a.pieces.find((p) => p.startSquare === 'g1');
    assert.ok(knight);
    assert.equal(a.moveCountByPieceId[knight!.id], 1);
  });

  it('counts developed white pieces', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    assert.ok(countDeveloped(a.pieces, 'w') >= 2);
  });

  it('exposes side to move and check state', () => {
    const a = analyzeHistory(['e4', 'e5', 'Qh5']);
    assert.equal(a.sideToMove, 'b');
    assert.equal(a.whiteInCheck, false);
  });
});

describe('question pool', () => {
  it('asks opening when identifiable at final ply', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const pool = buildQuestionPool(a);
    const opening = pool.find((q) => q.kind === 'opening_id');
    assert.ok(opening);
    assert.ok(opening!.accepted.length > 0);
  });

  it('skips opening when final position is out of book', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'h4']);
    const pool = buildQuestionPool(a);
    assert.equal(pool.find((q) => q.kind === 'opening_id'), undefined);
  });

  it('generates nth white and black move questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'nth_white_move' && q.displayAnswer === 'e4'));
    assert.ok(pool.find((q) => q.kind === 'nth_black_move' && q.displayAnswer === 'e5'));
  });

  it('generates last move questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'last_white_move' && q.displayAnswer === 'Nf3'));
    assert.ok(pool.find((q) => q.kind === 'last_black_move' && q.displayAnswer === 'Nc6'));
    assert.ok(pool.find((q) => q.kind === 'last_sequence_move' && q.displayAnswer === 'Nc6'));
  });

  it('generates capture questions when captures exist', () => {
    const a = analyzeHistory(CAPTURE_LINE);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'capture_count'));
    assert.ok(pool.find((q) => q.kind === 'first_capture'));
    assert.ok(pool.find((q) => q.kind === 'last_capture'));
    assert.ok(pool.some((q) => q.kind === 'who_captured_piece'));
  });

  it('does not generate capture count when no captures', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const pool = buildQuestionPool(a);
    assert.equal(pool.find((q) => q.kind === 'capture_count'), undefined);
  });

  it('generates castling rights vs history questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'castling_rights'));
    assert.ok(pool.find((q) => q.kind === 'castling_played' && q.displayAnswer === 'Non'));
  });

  it('generates piece location and captured status questions', () => {
    const a = analyzeHistory(['e4', 'd5', 'exd5']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.some((q) => q.kind === 'still_on_board' && q.displayAnswer.includes('capturé')));
    assert.ok(pool.some((q) => q.kind === 'locate_piece' || q.kind === 'piece_on_square'));
  });

  it('generates side to move and check questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'side_to_move'));
    assert.ok(pool.find((q) => q.kind === 'king_in_check'));
  });

  it('generates remaining piece counts and development questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.find((q) => q.kind === 'count_developed'));
    assert.ok(pool.find((q) => q.kind === 'first_white_piece_moved'));
    assert.ok(pool.some((q) => q.kind === 'piece_move_count'));
  });

  it('generates temporal questions from fen snapshots', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const pool = buildQuestionPool(a);
    assert.ok(pool.some((q) => q.kind === 'temporal_square_occupancy'));
  });

  it('deduplicates same facts in generateQuestions', () => {
    const a = analyzeHistory(ITALIAN_LINE);
    const qs = generateQuestions(a, { maxQuestions: 20, rng: () => 0.5 });
    const keys = qs.map((q) => q.factKey);
    assert.equal(keys.length, new Set(keys).size);
  });

  it('selects exactly 10 questions on a rich line', () => {
    const a = analyzeHistory(ITALIAN_LINE);
    const qs = generateQuestions(a, { maxQuestions: 10, rng: () => 0.42 });
    assert.equal(qs.length, 10);
    const categories = new Set(qs.map((q) => q.category));
    assert.ok(categories.size >= 4);
  });
});

describe('answer validation', () => {
  it('validates locate and square answers', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const qs = generateQuestions(a, { maxQuestions: 10, rng: () => 0 });
    const locate = qs.find((q) => q.kind === 'locate_piece' && q.displayAnswer === 'f3');
    if (locate) {
      assert.equal(validatePositionAnswer(locate, 'f3').correct, true);
      assert.equal(validatePositionAnswer(locate, 'Il est en f3').correct, true);
      assert.equal(validatePositionAnswer(locate, 'a1').correct, false);
    }
  });

  it('validates opening aliases', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    const pool = buildQuestionPool(a);
    const opening = pool.find((q) => q.kind === 'opening_id');
    if (opening) {
      assert.equal(validatePositionAnswer(opening, 'Partie italienne').correct, true);
    }
  });

  it('validates numeric capture count', () => {
    const a = analyzeHistory(CAPTURE_LINE);
    const pool = buildQuestionPool(a);
    const cap = pool.find((q) => q.kind === 'capture_count');
    assert.ok(cap);
    assert.equal(validatePositionAnswer(cap!, '2 captures').correct, true);
  });

  it('validates SAN move answers', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const pool = buildQuestionPool(a);
    const last = pool.find((q) => q.kind === 'last_black_move');
    assert.ok(last);
    assert.equal(validatePositionAnswer(last!, 'cavalier c6').correct, false);
    assert.equal(validatePositionAnswer(last!, 'Nc6').correct, true);
  });

  it('treats empty noise as recognition failure', () => {
    const a = analyzeHistory(['e4']);
    const qs = generateQuestions(a, { maxQuestions: 3, rng: () => 0 });
    assert.ok(qs[0]);
    assert.equal(validatePositionAnswer(qs[0], 'euh').recognitionFailure, true);
  });
});

describe('MentalPositionSession', () => {
  it('returns error when fewer than maxQuestions are available', () => {
    const analysis = analyzeHistory(['e4']);
    const qs = generateQuestions(analysis, { maxQuestions: 500 });
    assert.ok(qs.length < 500);
    const session = new MentalPositionSession();
    session.configure({
      orientation: 'w',
      showBoardDuringSequence: false,
      dictateSequence: false,
    });
    const snap = session.loadSequence(['e4'], { maxQuestions: 500 });
    assert.equal(snap.phase, 'error');
    assert.equal(snap.errorMessage, INSUFFICIENT_QUESTIONS_ERROR);
  });

  it('scores correct answers and builds answer log', () => {
    const session = new MentalPositionSession();
    session.configure({
      orientation: 'w',
      showBoardDuringSequence: false,
      dictateSequence: false,
    });
    const loaded = session.loadSequence(ITALIAN_LINE);
    assert.equal(loaded.phase, 'showing');
    assert.equal(loaded.questions.length, MENTAL_MAX_QUESTIONS);
    session.beginQuestions();
    const q0 = session.snapshot().currentPrompt;
    assert.ok(q0);
    const first = loaded.questions[0];
    session.answer(first.displayAnswer);
    const mid = session.snapshot();
    assert.equal(mid.answered, 1);
    assert.equal(mid.answerLog.length, 1);
    assert.equal(mid.answerLog[0].correct, true);
  });

  it('hides correctness and expected answer during the test', () => {
    const session = new MentalPositionSession();
    session.configure({
      orientation: 'w',
      showBoardDuringSequence: true,
      dictateSequence: true,
    });
    const loaded = session.loadSequence(ITALIAN_LINE);
    session.beginQuestions();
    const first = loaded.questions[0];
    const second = loaded.questions[1];
    // Wrong answer — must not leak expected text into live feedback.
    session.answer('__definitely-wrong__');
    let mid = session.snapshot();
    assert.equal(mid.lastFeedback, 'Réponse enregistrée');
    assert.doesNotMatch(mid.lastFeedback ?? '', /Incorrect|Attendu|Réponse :/i);
    assert.doesNotMatch(mid.lastFeedback ?? '', new RegExp(first.displayAnswer, 'i'));
    assert.equal(mid.answerLog[0]!.correct, false);
    assert.equal(mid.answerLog[0]!.expectedDisplay, first.displayAnswer);
    assert.equal(mid.questionIndex, 1);
    assert.ok(mid.currentPrompt);

    session.answer(second.displayAnswer);
    mid = session.snapshot();
    assert.equal(mid.lastFeedback, 'Réponse enregistrée');
    assert.doesNotMatch(mid.lastFeedback ?? '', /Correct/i);
    assert.equal(mid.score, 1);
    // Live score stays in session state but is not meant for mid-test UI.
    assert.equal(mid.answered, 2);
  });

  it('keeps full review data for the final screen', () => {
    const session = new MentalPositionSession();
    session.configure({
      orientation: 'w',
      showBoardDuringSequence: true,
      dictateSequence: true,
    });
    const loaded = session.loadSequence(ITALIAN_LINE);
    session.beginQuestions();
    for (const q of loaded.questions) {
      session.answer(q.displayAnswer);
    }
    const done = session.snapshot();
    assert.equal(done.phase, 'done');
    assert.equal(done.score, MENTAL_MAX_QUESTIONS);
    assert.equal(done.answerLog.length, MENTAL_MAX_QUESTIONS);
    for (const entry of done.answerLog) {
      assert.ok(entry.question.promptFr);
      assert.ok(entry.userAnswer);
      assert.ok(entry.expectedDisplay);
      assert.equal(entry.correct, true);
    }
  });

  it('records help usage', () => {
    const session = new MentalPositionSession();
    session.loadSequence(ITALIAN_LINE);
    session.recordHelp('redictate');
    assert.equal(session.snapshot().helpUsed, true);
  });
});

describe('generateMentalSequence', () => {
  it('produces a legal line without an engine', async () => {
    const { sans, key } = await generateMentalSequence({ fullMoves: 3, rng: () => 0.2 });
    assert.ok(sans.length >= 4);
    assert.ok(key.length > 0);
    assert.doesNotThrow(() => analyzeHistory(sans));
  });

  it('retries with longer lines until 10 questions are available', async () => {
    const result = await generateMentalSequenceWithQuestions({
      fullMoves: 4,
      rng: () => 0.33,
    });
    const qs = generateQuestions(analyzeHistory(result.sans), { maxQuestions: 10, rng: () => 0.33 });
    assert.ok(qs.length >= 10);
    assert.ok(result.fullMovesUsed >= 4);
  });
});
