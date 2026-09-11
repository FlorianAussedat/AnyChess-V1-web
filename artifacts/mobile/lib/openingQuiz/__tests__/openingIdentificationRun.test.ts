/**
 * Quelle ouverture — session-of-10 runner + records + UX contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  OpeningIdentificationRun,
  OPENING_QUIZ_SESSION_SIZE,
} from '../OpeningIdentificationRun.ts';
import { OpeningQuizRecordsStore } from '../OpeningQuizRecordsStore.ts';
import {
  eligibleLinesForDifficulty,
  familyOfOpeningName,
  pickDistinctLinesForDifficulty,
} from '../openingQuestionBuilder.ts';

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

describe('OpeningIdentificationRun session of 10', () => {
  it('starts with exactly 10 distinct lines from the chosen level', () => {
    const run = new OpeningIdentificationRun();
    const snap = run.start('debutant', () => 0.2);
    assert.equal(snap.insufficientLines, false);
    assert.equal(snap.totalQuestions, OPENING_QUIZ_SESSION_SIZE);
    assert.equal(snap.questionIndex, 0);
    assert.equal(snap.score, 0);
    assert.equal(snap.finished, false);
    assert.ok(snap.line);

    const names = new Set<string>();
    // Finish all 10 by answering (wrong) and advancing — collect line names from review.
    for (let i = 0; i < OPENING_QUIZ_SESSION_SIZE; i += 1) {
      const current = run.snapshot();
      assert.ok(current.line);
      names.add(current.line.identity.name);
      run.answer('___not_a_real_opening___');
      run.next();
    }
    const done = run.snapshot();
    assert.equal(done.finished, true);
    assert.equal(done.score, 0);
    assert.equal(done.review.length, OPENING_QUIZ_SESSION_SIZE);
    assert.equal(names.size, OPENING_QUIZ_SESSION_SIZE);
    assert.equal(done.review.map((r) => r.lineName).sort().join('|'), [...names].sort().join('|'));
  });

  it('filters lines with the same difficulty eligibility rules', () => {
    const expertPool = eligibleLinesForDifficulty('expert');
    const confirmePool = eligibleLinesForDifficulty('confirme');
    assert.ok(expertPool.length >= OPENING_QUIZ_SESSION_SIZE);
    assert.ok(confirmePool.length >= OPENING_QUIZ_SESSION_SIZE);
    for (const line of expertPool.slice(0, 20)) {
      const family = familyOfOpeningName(line.identity.name);
      // expert prefers families with ≥4 variations (when such exist)
      assert.ok(family.length > 0);
    }
    const picked = pickDistinctLinesForDifficulty('expert', 10, () => 0.33);
    assert.equal(picked.length, 10);
    assert.equal(new Set(picked.map((l) => l.identity.name)).size, 10);
  });

  it('scores correct answers as 1 and wrong as 0 (final X/10)', () => {
    const run = new OpeningIdentificationRun();
    const snap = run.start('debutant', fixedRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    assert.equal(snap.totalQuestions, 10);

    for (let i = 0; i < 10; i += 1) {
      const current = run.snapshot();
      const family = familyOfOpeningName(current.line!.identity.name);
      // Correct on even indices
      if (i % 2 === 0) {
        run.answer(family);
      } else {
        const wrong = current.options.find((o) => o !== family) ?? 'nope';
        run.answer(wrong);
      }
      run.next();
    }
    const done = run.snapshot();
    assert.equal(done.finished, true);
    assert.equal(done.score, 5);
    assert.equal(done.totalQuestions, 10);
    assert.equal(done.review.filter((r) => r.correct).length, 5);
    assert.equal(done.review.filter((r) => !r.correct).length, 5);
  });

  it('reports insufficient lines without crashing or repeating', () => {
    const run = new OpeningIdentificationRun();
    const poolSize = eligibleLinesForDifficulty('debutant').length;
    const snap = run.start('debutant', () => 0.5, poolSize + 50);
    assert.equal(snap.insufficientLines, true);
    assert.equal(snap.availableLineCount, poolSize);
    assert.equal(snap.totalQuestions, 0);
    assert.equal(snap.line, null);
    assert.equal(snap.finished, false);
    // Answering / next must be no-ops
    assert.equal(run.answer('Sicilian').insufficientLines, true);
    assert.equal(run.next().insufficientLines, true);
  });
});

describe('OpeningQuizRecordsStore', () => {
  it('updates best only when the candidate is strictly greater', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new OpeningQuizRecordsStore(mem);
    const first = await store.saveScore('debutant', 7);
    assert.equal(first.isNewRecord, true);
    assert.equal(first.best, 7);

    const equal = await store.saveScore('debutant', 7);
    assert.equal(equal.isNewRecord, false);
    assert.equal(equal.best, 7);

    const worse = await store.saveScore('debutant', 4);
    assert.equal(worse.isNewRecord, false);
    assert.equal(worse.best, 7);

    const better = await store.saveScore('debutant', 9);
    assert.equal(better.isNewRecord, true);
    assert.equal(better.best, 9);

    assert.equal(await store.loadBest('debutant'), 9);
    assert.equal(await store.loadBest('expert'), 0);
  });

  it('keeps difficulties independent and clamps to /10', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new OpeningQuizRecordsStore(mem);
    await store.saveScore('confirme', 10);
    await store.saveScore('expert', 3);
    const all = await store.load();
    assert.equal(all.bestByDifficulty.confirme, 10);
    assert.equal(all.bestByDifficulty.expert, 3);
    const over = await store.saveScore('confirme', 99);
    assert.equal(over.best, 10);
    assert.equal(over.isNewRecord, false);
  });
});

describe('quelle UX contracts (session rewrite)', () => {
  it('uses a text-only level picker (no DifficultySelector / knight assets)', () => {
    const src = readFileSync(join(quizDir, 'quelle.tsx'), 'utf8');
    assert.doesNotMatch(src, /DifficultySelector/);
    assert.doesNotMatch(src, /BrandAssets\.difficulty/);
    assert.doesNotMatch(src, /BrandAssets/);
    assert.match(src, /quelle-level-picker/);
    assert.match(src, /testID=\{`quelle-level-\$\{id\}`\}/);
    assert.match(src, /ANYCHESS_DIFFICULTIES\.map/);
    assert.match(src, /OptionChip/);
    assert.match(src, /pick-level/);
    assert.match(src, /OpeningIdentificationRun/);
    assert.match(src, /quelle-results/);
    assert.match(src, /quelle-review/);
    assert.match(src, /quelle-mcq/);
    assert.match(src, /quelle-freetext/);
    assert.match(src, /ChessAnswerInput/);
    assert.match(src, /GameMicButton/);
  });

  it('exposes the four text level choices', () => {
    const src = readFileSync(join(quizDir, 'quelle.tsx'), 'utf8');
    assert.match(src, /ANYCHESS_DIFFICULTIES/);
    for (const id of ['debutant', 'confirme', 'expert', 'grandMaitre'] as const) {
      assert.match(src, new RegExp(`difficulty\\.${id}`));
    }
  });
});
