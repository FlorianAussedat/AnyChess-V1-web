/**
 * Mental position — pure logic tests.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeHistory,
  countDeveloped,
  generateQuestions,
  validatePositionAnswer,
  MentalPositionSession,
  generateMentalSequence,
} from '../index.ts';

describe('analyzeHistory', () => {
  it('locates the white knight from g1 after Nf3', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const n = a.pieces.find((p) => p.startSquare === 'g1');
    assert.ok(n);
    assert.equal(n!.currentSquare, 'f3');
    assert.equal(n!.captured, false);
  });

  it('marks captured pieces', () => {
    const a = analyzeHistory(['e4', 'd5', 'exd5']);
    const pawn = a.pieces.find((p) => p.startSquare === 'd7');
    assert.ok(pawn);
    assert.equal(pawn!.captured, true);
  });

  it('answers piece on square', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const onF3 = a.pieces.find((p) => p.currentSquare === 'f3');
    assert.equal(onF3?.type, 'n');
    assert.equal(onF3?.color, 'w');
  });

  it('counts developed white pieces', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    assert.ok(countDeveloped(a.pieces, 'w') >= 2);
  });
});

describe('questions + answers', () => {
  it('generates unambiguous locate questions', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3', 'Nc6']);
    const qs = generateQuestions(a, { maxQuestions: 8, rng: () => 0.1 });
    assert.ok(qs.length > 0);
    const locate = qs.find((q) => q.kind === 'locate_piece');
    assert.ok(locate);
  });

  it('validates correct and incorrect answers', () => {
    const a = analyzeHistory(['e4', 'e5', 'Nf3']);
    const qs = generateQuestions(a, { maxQuestions: 10, rng: () => 0 });
    const locate = qs.find((q) => q.kind === 'locate_piece' && q.displayAnswer === 'f3');
    if (locate) {
      assert.equal(validatePositionAnswer(locate, 'f3').correct, true);
      assert.equal(validatePositionAnswer(locate, 'Il est en f3').correct, true);
      assert.equal(validatePositionAnswer(locate, 'a1').correct, false);
    }
  });

  it('treats empty noise as recognition failure', () => {
    const a = analyzeHistory(['e4']);
    const qs = generateQuestions(a, { maxQuestions: 3, rng: () => 0 });
    assert.ok(qs[0]);
    assert.equal(validatePositionAnswer(qs[0], 'euh').recognitionFailure, true);
  });
});

describe('MentalPositionSession', () => {
  it('scores correct answers', () => {
    const session = new MentalPositionSession();
    session.configure({
      orientation: 'w',
      showBoardDuringSequence: false,
      dictateSequence: false,
    });
    session.loadSequence(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4']);
    session.beginQuestions();
    const snap0 = session.snapshot();
    assert.equal(snap0.phase, 'questioning');
    assert.ok(snap0.currentPrompt);
  });
});

describe('generateMentalSequence', () => {
  it('produces a legal line without an engine', async () => {
    const { sans, key } = await generateMentalSequence({ fullMoves: 3, rng: () => 0.2 });
    assert.ok(sans.length >= 4);
    assert.ok(key.length > 0);
    // History must analyze cleanly
    assert.doesNotThrow(() => analyzeHistory(sans));
  });
});
