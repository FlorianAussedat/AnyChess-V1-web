import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpeningName } from '../OpeningNameNormalizer.ts';
import { validateOpeningAnswer } from '../OpeningAnswerValidator.ts';
import { availableOpeningQuizLines } from '../OpeningQuizSelector.ts';
import { OpeningIdentificationSession } from '../OpeningIdentificationSession.ts';
import { findOpeningTarget } from '../OpeningLineBuilder.ts';
import { OpeningConstructionSession } from '../OpeningConstructionSession.ts';

describe('opening answer normalization and hierarchy', () => {
  it('normalizes accents and accepts a family for variations', () => {
    assert.equal(normalizeOpeningName('Défense  Française!'), 'defense francaise');
    assert.equal(validateOpeningAnswer('partie italienne', 'Italian Game: Giuoco Piano').correct, true);
  });
});

describe('opening selector and identification', () => {
  it('selects dataset-identifiable lines and keeps first answer', () => {
    const lines = availableOpeningQuizLines();
    assert.ok(lines.length > 0);
    const session = new OpeningIdentificationSession();
    const initial = session.start([], () => 0);
    assert.ok(initial.line);
    const first = session.answer('nonsense');
    const second = session.answer(initial.line!.identity.name);
    assert.equal(first.verdict?.correct, false);
    assert.equal(second.verdict?.correct, false);
  });
});

describe('opening construction', () => {
  it('requires its exact reference line and reveals it on first wrong move', () => {
    const target = findOpeningTarget('Italian Game') ?? availableOpeningQuizLines()[0];
    assert.ok(target);
    const session = new OpeningConstructionSession(target);
    const wrong = session.answer('a4');
    assert.equal(wrong.phase, 'wrong');
    assert.match(wrong.feedback ?? '', /suite attendue/);
  });

  it('offers Italian, Giuoco Piano, and Accelerated Dragon when indexed', () => {
    const names = availableOpeningQuizLines().map((line) => line.identity.name).join(' ');
    assert.match(names, /Italian|Sicilian/);
  });
});
