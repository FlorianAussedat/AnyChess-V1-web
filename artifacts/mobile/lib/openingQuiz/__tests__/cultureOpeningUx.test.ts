/**
 * Culture générale Pass 3 — Quelle / Quiz UX contracts.
 * (Défends la nulle moved to Entraînement tactique.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupOpeningSans } from '../groupOpeningSans.ts';

const here = dirname(fileURLToPath(import.meta.url));
const quizDir = join(here, '../../../app/quiz-ouverture');

describe('quelle ouverture harmonization', () => {
  it('uses NumberedSanRows + difficulty selector + answer paths', () => {
    const src = readFileSync(join(quizDir, 'quelle.tsx'), 'utf8');
    assert.match(src, /NumberedSanRows/);
    assert.match(src, /DifficultySelector/);
    assert.match(src, /ChessAnswerInput/);
    assert.match(src, /GameMicButton/);
    assert.match(src, /quelle-mic/);
    assert.match(src, /quelle-mcq/);
    assert.doesNotMatch(src, /Valider/);
    assert.doesNotMatch(src, /sans\.join\(/);
  });

  it('keeps odd/even ply numbered grouping', () => {
    const rows = groupOpeningSans(['e4', 'e5', 'Nf3']);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.white, 'e4');
    assert.equal(rows[0]!.black, 'e5');
    assert.equal(rows[1]!.white, 'Nf3');
    assert.equal(rows[1]!.black ?? null, null);
  });
});

describe('culture hub no longer hosts Défends la nulle', () => {
  it('hub and layout only keep Quelle + Culture quiz', () => {
    const hub = readFileSync(join(quizDir, 'index.tsx'), 'utf8');
    const layout = readFileSync(join(quizDir, '_layout.tsx'), 'utf8');
    assert.match(hub, /quelle/);
    assert.match(hub, /culture/);
    assert.doesNotMatch(hub, /defends-nulle/);
    assert.doesNotMatch(hub, /construis/);
    assert.doesNotMatch(layout, /defends-nulle/);
  });
});

describe('culture quiz polish', () => {
  it('keeps immediate feedback and places visual between question and answers', () => {
    const src = readFileSync(join(quizDir, 'culture.tsx'), 'utf8');
    assert.match(src, /Bonne réponse|Mauvaise réponse|quiz\.goodAnswer|quiz\.badAnswer/);
    assert.match(src, /culture-progress-bar/);
    assert.match(src, /sizeMode=["']wide["']/);
    const q = src.indexOf('current.question.question');
    const visual = src.indexOf('<ChessCultureVisual');
    const board = src.indexOf('board ?');
    const answers = src.indexOf('styles.answers');
    assert.ok(q > 0 && visual > q && board > visual && answers > board);
  });
});
