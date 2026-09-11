/**
 * Lot 4 — Quelle ouverture? difficulty + smart distractors.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpeningIdentificationSession } from '../OpeningIdentificationSession.ts';
import {
  buildFamilyOptions,
  buildOpeningQuestion,
  buildVariationOptions,
  familyOfOpeningName,
} from '../openingQuestionBuilder.ts';
import { availableOpeningQuizLines, variationsForFamily } from '../OpeningQuizSelector.ts';

const here = dirname(fileURLToPath(import.meta.url));
const quizDir = join(here, '../../../app/quiz-ouverture');

function fixedRng(seq: number[]): () => number {
  let i = 0;
  return () => {
    const v = seq[i % seq.length] ?? 0.5;
    i += 1;
    return v;
  };
}

describe('opening question builder', () => {
  it('builds 4 family options for débutant including the correct family', () => {
    const q = buildOpeningQuestion('debutant', [], () => 0.1);
    assert.ok(q);
    assert.equal(q!.answerMode, 'mcq');
    assert.equal(q!.options.length, 4);
    assert.ok(q!.options.includes(q!.correctFamily));
    assert.equal(new Set(q!.options).size, 4);
  });

  it('builds 8 variation options for expert preferring siblings when available', () => {
    const rich = availableOpeningQuizLines().find(
      (l) => variationsForFamily(familyOfOpeningName(l.identity.name)).length >= 8,
    );
    assert.ok(rich);
    const opts = buildVariationOptions(rich!, 8, () => 0.2);
    assert.equal(opts.length, 8);
    assert.ok(opts.includes(rich!.identity.name));
    assert.equal(new Set(opts).size, 8);
  });

  it('builds confirmé with step-2 variation options', () => {
    const q = buildOpeningQuestion('confirme', [], () => 0.3);
    assert.ok(q);
    assert.equal(q!.answerMode, 'mcq');
    assert.equal(q!.options.length, 4);
    assert.ok(q!.step2Options);
    assert.equal(q!.step2Options!.length, 4);
    assert.ok(q!.step2Options!.includes(q!.correctName));
  });

  it('keeps grand-maître as free-text', () => {
    const q = buildOpeningQuestion('grandMaitre', [], () => 0.4);
    assert.ok(q);
    assert.equal(q!.answerMode, 'free-text');
    assert.deepEqual(q!.options, []);
  });

  it('never places the correct family twice in distractors', () => {
    const family = familyOfOpeningName(availableOpeningQuizLines()[0]!.identity.name);
    const opts = buildFamilyOptions(family, 4, fixedRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    assert.equal(opts.filter((o) => o === family).length, 1);
  });
});

describe('OpeningIdentificationSession difficulty modes', () => {
  it('débutant accepts the correct family option', () => {
    const session = new OpeningIdentificationSession();
    const snap = session.startWithDifficulty('debutant', [], () => 0);
    assert.equal(snap.answerMode, 'mcq');
    assert.equal(snap.options.length, 4);
    const family = familyOfOpeningName(snap.line!.identity.name);
    const wrong = session.answer(snap.options.find((o) => o !== family) ?? 'nope');
    assert.equal(wrong.answered, true);
    assert.equal(wrong.verdict?.correct, false);

    const again = session.startWithDifficulty('debutant', [], () => 0);
    const ok = session.answer(familyOfOpeningName(again.line!.identity.name));
    assert.equal(ok.verdict?.correct, true);
  });

  it('confirmé advances to step 2 on correct family then grades variation', () => {
    const session = new OpeningIdentificationSession();
    const snap = session.startWithDifficulty('confirme', [], () => 0.15);
    assert.equal(snap.step, 1);
    const family = familyOfOpeningName(snap.line!.identity.name);
    const mid = session.answer(family);
    assert.equal(mid.answered, false);
    assert.equal(mid.step, 2);
    assert.equal(mid.options.length, 4);
    const done = session.answer(snap.line!.identity.name);
    assert.equal(done.answered, true);
    assert.equal(done.verdict?.correct, true);
  });

  it('expert grades full variation name among 8 options', () => {
    const session = new OpeningIdentificationSession();
    const snap = session.startWithDifficulty('expert', [], () => 0.25);
    assert.equal(snap.options.length, 8);
    const ok = session.answer(snap.line!.identity.name);
    assert.equal(ok.verdict?.correct, true);
  });
});

describe('quelle difficulty UX contracts', () => {
  it('wires text level picker and MCQ / free-text modes (no knight DifficultySelector)', () => {
    const src = readFileSync(join(quizDir, 'quelle.tsx'), 'utf8');
    assert.doesNotMatch(src, /DifficultySelector/);
    assert.doesNotMatch(src, /BrandAssets\.difficulty/);
    assert.match(src, /quelle-level-picker/);
    assert.match(src, /quelle-mcq/);
    assert.match(src, /quelle-freetext/);
    assert.match(src, /grandMaitre|free-text/);
    assert.match(src, /ChessAnswerInput/);
    assert.match(src, /GameMicButton/);
  });
});
