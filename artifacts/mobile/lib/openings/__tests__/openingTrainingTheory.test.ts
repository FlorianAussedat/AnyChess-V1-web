/**
 * Opening display name + theory training state contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getOpeningDisplayName } from '../openingDisplayName.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('getOpeningDisplayName', () => {
  it('displays opening only', () => {
    assert.equal(
      getOpeningDisplayName({ headers: { Opening: 'Italian Game' } }),
      'Italian Game',
    );
  });

  it('displays opening + variation', () => {
    assert.equal(
      getOpeningDisplayName({
        headers: { Opening: 'Italian Game', Variation: 'Giuoco Piano' },
      }),
      'Italian Game · Giuoco Piano',
    );
  });

  it('displays more precise metadata when available', () => {
    assert.equal(
      getOpeningDisplayName({
        headers: {
          Opening: 'Italian Game',
          Variation: 'Two Knights Defense',
          SubVariation: 'Traxler',
        },
      }),
      'Italian Game · Two Knights Defense · Traxler',
    );
  });

  it('does not invent a variation', () => {
    assert.equal(
      getOpeningDisplayName({ headers: { Opening: 'Italian Game' }, ecoName: null }),
      'Italian Game',
    );
    assert.equal(getOpeningDisplayName({ headers: {} }), null);
  });

  it('falls back to eco name only when headers are empty', () => {
    assert.equal(
      getOpeningDisplayName({ ecoName: 'Italian Game' }),
      'Italian Game',
    );
  });

  it('deduplicates identical opening/variation strings', () => {
    assert.equal(
      getOpeningDisplayName({
        headers: { Opening: 'Sicilian Defense', Variation: 'Sicilian Defense' },
      }),
      'Sicilian Defense',
    );
  });
});

describe('opening training states', () => {
  it('OpeningOpponent maps phases to explicit training states', () => {
    const opp = read('lib/moves/OpeningOpponent.ts');
    assert.match(opp, /OpeningTrainingState/);
    assert.match(opp, /'playingTheory'/);
    assert.match(opp, /'lineComplete'/);
    assert.match(opp, /'outOfTheory'/);
    assert.match(opp, /'engineContinuation'/);
    assert.match(opp, /trainingStateFromPhase/);
  });

  it('OpeningOpponent pauses on repertoire-end without auto engine reply', () => {
    const opp = read('lib/moves/OpeningOpponent.ts');
    assert.match(opp, /phase = 'lineComplete'/);
    assert.match(opp, /phase = 'outOfTheory'/);
    assert.match(opp, /continueVsEngine/);
    assert.match(
      opp,
      /this\.phase = 'lineComplete';\s*return \{ move: null, theoryMessage: exit\.message \};/,
    );
  });

  it('OpeningGameScreen keeps variation label and decision panels', () => {
    const screen = read('components/OpeningGameScreen.tsx');
    assert.match(screen, /OpeningVariationLabel/);
    assert.match(screen, /TheoryDecisionPanel/);
    assert.match(screen, /opening-status-row/);
    assert.match(screen, /BoardCoordinatesToggle/);
    assert.match(screen, /trainingState === 'lineComplete'/);
    assert.match(screen, /trainingState === 'outOfTheory'/);
  });

  it('context exposes continue / undo / expected / restart / next', () => {
    const ctx = read('contexts/OpeningGameContext.tsx');
    assert.match(ctx, /continueVsEngine/);
    assert.match(ctx, /undoAndThinkAgain/);
    assert.match(ctx, /showExpectedMove/);
    assert.match(ctx, /restartLine/);
    assert.match(ctx, /nextLine/);
    assert.match(ctx, /openingLabel/);
  });
});

describe('openings review buttons', () => {
  it('uses the same primary style for all three enabled review buttons', () => {
    const src = read('components/openings/OpeningsReviewBlock.tsx');
    assert.match(src, /review-all-btn/);
    assert.match(src, /review-white-btn/);
    assert.match(src, /review-black-btn/);
    assert.match(src, /colors\.primary/);
    assert.match(src, /disabled \? colors\.input : colors\.primary/);
    assert.doesNotMatch(src, /reviewBtnLabelMuted/);
  });
});

describe('continue line opening label', () => {
  it('wires sourceLabel from repertoire headers and shows the label', () => {
    const cont = read('app/openings/continue.tsx');
    assert.match(cont, /getOpeningDisplayName/);
    assert.match(cont, /continue-opening-label/);
    assert.match(cont, /openingLabelFromRepertoire/);
  });
});
