import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpeningName } from '../OpeningNameNormalizer.ts';
import { validateOpeningAnswer } from '../OpeningAnswerValidator.ts';
import {
  availableOpeningQuizLines,
  openingFamilyCount,
  openingFamilyNames,
  openingVariationCount,
  pickRandomVariation,
  variationsForFamily,
} from '../OpeningQuizSelector.ts';
import { OpeningIdentificationSession } from '../OpeningIdentificationSession.ts';
import { findOpeningTarget } from '../OpeningLineBuilder.ts';
import { OpeningConstructionSession } from '../OpeningConstructionSession.ts';
import { replayLine } from '../../replay/replayLine.ts';

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

  it('exposes substantially more families and variations from ECO data', () => {
    assert.ok(openingFamilyCount() >= 50);
    assert.ok(openingVariationCount() >= 200);
    const families = openingFamilyNames();
    assert.ok(families.some((f) => /Italian|Sicilian|French|Caro/i.test(f)));
    const italian = variationsForFamily(
      families.find((f) => f.includes('Italian')) ?? families[0],
    );
    assert.ok(italian.length >= 1);
  });

  it('pickRandomVariation returns a family and identifiable line', () => {
    const pick = pickRandomVariation(() => 0.5);
    assert.ok(pick);
    assert.ok(pick!.family.length > 0);
    assert.ok(pick!.line.sans.length >= 4);
  });
});

describe('opening construction', () => {
  it('hides expectedSan from player snapshot during play', () => {
    const target = findOpeningTarget('Italian Game') ?? availableOpeningQuizLines()[0];
    assert.ok(target);
    const session = new OpeningConstructionSession(target);
    const player = session.snapshotForPlayer();
    assert.equal(player.phase, 'playing');
    assert.equal('expectedSan' in player, false);
    const internal = session.snapshot();
    assert.ok(internal.expectedSan);
  });

  it('requires its exact reference line and reveals it on first wrong move', () => {
    const target = findOpeningTarget('Italian Game') ?? availableOpeningQuizLines()[0];
    assert.ok(target);
    const session = new OpeningConstructionSession(target);
    const wrong = session.answer('a4');
    assert.equal(wrong.phase, 'wrong');
    assert.equal(wrong.lastAttemptedSan, 'a4');
    assert.match(wrong.feedback ?? '', /Incorrect/);
    assert.match(wrong.feedback ?? '', /Ligne complète/);
    const after = session.snapshotForPlayer();
    assert.ok(after.expectedSan);
  });

  it('does not stop on recognition failure', () => {
    const target = availableOpeningQuizLines()[0];
    const session = new OpeningConstructionSession({ identity: target.identity, sans: target.sans });
    const fail = session.answer('zzzz nonsense');
    assert.equal(fail.phase, 'playing');
    assert.match(fail.feedback ?? '', /reconnu|Ambigu/i);
  });

  it('cancels line replay cleanly', async () => {
    let completed = false;
    const handle = replayLine({
      moves: ['e4', 'e5', 'Nf3', 'Nc6'],
      intervalMs: 40,
      onMove: () => {},
      onComplete: () => {
        completed = true;
      },
    });
    await new Promise((r) => setTimeout(r, 15));
    handle.cancel();
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(completed, false);
  });
});
