/**
 * Quelle ouverture? level picker copy must match the real 10-question
 * session and the existing difficulty mechanics — not invented Elo bands.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { translate } from '../../i18n/messages.ts';
import { OPENING_QUIZ_SESSION_SIZE } from '../OpeningIdentificationRun.ts';
import { buildOpeningQuestion } from '../openingQuestionBuilder.ts';

const here = dirname(fileURLToPath(import.meta.url));
const quelleSrc = readFileSync(join(here, '../../../app/quiz-ouverture/quelle.tsx'), 'utf8');

describe('quelle level presentation', () => {
  it('announces the real session length and starts a level from the whole card', () => {
    assert.equal(OPENING_QUIZ_SESSION_SIZE, 10);
    assert.match(
      translate('fr', 'quiz.quelleIntro', { count: OPENING_QUIZ_SESSION_SIZE }),
      /10 questions/,
    );
    assert.match(
      translate('en', 'quiz.quelleIntro', { count: OPENING_QUIZ_SESSION_SIZE }),
      /10-question/,
    );
    assert.match(quelleSrc, /quiz\.quelleIntro/);
    assert.match(quelleSrc, /OPENING_QUIZ_SESSION_SIZE/);
    assert.match(quelleSrc, /styles\.levelCard/);
    assert.match(quelleSrc, /onPress=\{\(\) => startLevel\(id\)\}/);
    assert.doesNotMatch(quelleSrc, /OptionChip/);
    assert.doesNotMatch(quelleSrc, /Elo/);
  });

  it('describes family / variation / free-text without implying a sharper question bank', () => {
    assert.match(translate('fr', 'quiz.quelleLevel.debutant'), /noms des ouvertures/);
    assert.match(translate('fr', 'quiz.quelleLevel.confirme'), /variantes/);
    assert.match(translate('fr', 'quiz.quelleLevel.expert'), /variantes/);
    assert.match(translate('fr', 'quiz.quelleLevel.grandMaitre'), /sans propositions/);
    assert.doesNotMatch(translate('fr', 'quiz.quelleLevel.grandMaitre'), /pointues|Elo|classement/);
    assert.doesNotMatch(translate('en', 'quiz.quelleLevel.grandMaitre'), /sharper|Elo|rating/);

    const debutant = buildOpeningQuestion('debutant', [], () => 0.2);
    const confirme = buildOpeningQuestion('confirme', [], () => 0.2);
    const expert = buildOpeningQuestion('expert', [], () => 0.2);
    const gm = buildOpeningQuestion('grandMaitre', [], () => 0.2);
    assert.equal(debutant?.answerMode, 'mcq');
    assert.equal(debutant?.options.length, 4);
    assert.equal(debutant?.step2Options, null);
    assert.equal(confirme?.options.length, 4);
    assert.equal(confirme?.step2Options?.length, 4);
    assert.equal(expert?.options.length, 8);
    assert.equal(gm?.answerMode, 'free-text');
  });
});
