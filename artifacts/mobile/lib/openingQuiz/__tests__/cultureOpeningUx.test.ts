/**
 * Culture générale Pass 3 — Construis / Quelle / Quiz UX contracts.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OpeningConstructionSession } from '../OpeningConstructionSession.ts';
import {
  availableOpeningQuizLines,
  findOpeningTarget,
} from '../index.ts';
import { groupOpeningSans } from '../groupOpeningSans.ts';

const here = dirname(fileURLToPath(import.meta.url));
const quizDir = join(here, '../../../app/quiz-ouverture');

describe('construis selection / training state', () => {
  it('keeps selection UI and collapses into compact summary after target choice', () => {
    const src = readFileSync(join(quizDir, 'construis.tsx'), 'utf8');
    assert.match(src, /construis-selection/);
    assert.match(src, /construis-summary/);
    assert.match(src, /construis-changer/);
    assert.match(src, /configExpanded/);
    assert.match(src, /inTraining/);
    // Random must resolve to a real opening summary, not stay labeled only Aléatoire.
    assert.match(src, /pickRandomVariation/);
    assert.match(src, /target\.identity\.name/);
    assert.match(src, /\{family\} · \{target\.identity\.name\}/);
  });

  it('opts training board into wide sizing and keeps mic on answer path', () => {
    const src = readFileSync(join(quizDir, 'construis.tsx'), 'utf8');
    assert.match(src, /useBoardSize\('wide'\)/);
    assert.match(src, /sizeMode=["']wide["']/);
    assert.match(src, /GameMicButton/);
    assert.match(src, /Parler|construis-mic/);
    assert.match(src, /WRONG_REPLAY_INTERVAL_MS = 2000/);
    assert.match(src, /SUCCESS_REPLAY_INTERVAL_MS = 1000/);
    assert.match(src, /Revoir l’ouverture|construis-review/);
  });
});

describe('construis wrong-answer contract', () => {
  it('shows short feedback, keeps target, and can restart the same line', () => {
    const target = findOpeningTarget('Italian Game') ?? availableOpeningQuizLines()[0];
    assert.ok(target);
    const session = new OpeningConstructionSession(target);
    const wrong = session.answer('a4');
    assert.equal(wrong.phase, 'wrong');
    assert.equal(wrong.feedback, 'Incorrect');
    assert.ok(wrong.expectedSan);
    assert.doesNotMatch(wrong.feedback ?? '', /Ligne complète|e4 Nf3|sans\.join/i);
    assert.equal(wrong.target.identity.name, target.identity.name);

    const again = session.restart();
    assert.equal(again.phase, 'playing');
    assert.deepEqual(again.playedSans, []);
    assert.equal(again.target.identity.name, target.identity.name);
  });
});

describe('quelle ouverture harmonization', () => {
  it('uses NumberedSanRows + shared answer input + mic', () => {
    const src = readFileSync(join(quizDir, 'quelle.tsx'), 'utf8');
    assert.match(src, /NumberedSanRows/);
    assert.match(src, /ChessAnswerInput/);
    assert.match(src, /GameMicButton/);
    assert.match(src, /quelle-mic/);
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

describe('culture quiz polish', () => {
  it('keeps immediate feedback and places visual between question and answers', () => {
    const src = readFileSync(join(quizDir, 'culture.tsx'), 'utf8');
    assert.match(src, /Bonne réponse|Mauvaise réponse/);
    assert.match(src, /culture-progress-bar/);
    assert.match(src, /sizeMode=["']wide["']/);
    // Question text appears before ChessCultureVisual / board in source order.
    const q = src.indexOf('current.question.question');
    const visual = src.indexOf('<ChessCultureVisual');
    const board = src.indexOf('board ?');
    const answers = src.indexOf('styles.answers');
    assert.ok(q > 0 && visual > q && board > visual && answers > board);
  });
});
