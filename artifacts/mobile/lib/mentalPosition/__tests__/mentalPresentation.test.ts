/**
 * Suivi mental setup helpers — slider range + dictate/board constraint.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MENTAL_FULL_MOVES_MAX,
  MENTAL_FULL_MOVES_MIN,
  clampMentalFullMoves,
  mentalFullMoveStops,
  mentalHalfMoveCount,
  toggleMentalPresentation,
} from '../mentalPresentation.ts';
import { sideToMoveLabel } from '../../playMove/sideToMoveLabel.ts';

const here = dirname(fileURLToPath(import.meta.url));
const vizDir = join(here, '../../../app/visualisation');

describe('mental full-move DiscreteSlider mapping', () => {
  it('clamps to 2–20 with 19 discrete integer stops', () => {
    const stops = mentalFullMoveStops();
    assert.equal(stops.length, 19);
    assert.equal(stops[0], 2);
    assert.equal(stops[18], 20);
    assert.equal(MENTAL_FULL_MOVES_MIN, 2);
    assert.equal(MENTAL_FULL_MOVES_MAX, 20);
    assert.equal(clampMentalFullMoves(1), 2);
    assert.equal(clampMentalFullMoves(99), 20);
    assert.equal(clampMentalFullMoves(4.4), 4);
  });

  it('maps selected full moves to half-moves', () => {
    assert.equal(mentalHalfMoveCount(2), 4);
    assert.equal(mentalHalfMoveCount(4), 8);
    assert.equal(mentalHalfMoveCount(20), 40);
  });
});

describe('mental dictate / board constraint', () => {
  it('allows dictate-only, board-only, and both', () => {
    assert.deepEqual(toggleMentalPresentation({ dictate: true, showBoard: true }, 'dictate'), {
      dictate: false,
      showBoard: true,
    });
    assert.deepEqual(toggleMentalPresentation({ dictate: true, showBoard: true }, 'showBoard'), {
      dictate: true,
      showBoard: false,
    });
    assert.deepEqual(toggleMentalPresentation({ dictate: false, showBoard: true }, 'dictate'), {
      dictate: true,
      showBoard: true,
    });
  });

  it('blocks disabling the last active option', () => {
    assert.equal(
      toggleMentalPresentation({ dictate: true, showBoard: false }, 'dictate'),
      null,
    );
    assert.equal(
      toggleMentalPresentation({ dictate: false, showBoard: true }, 'showBoard'),
      null,
    );
  });
});

describe('vision side-to-move labels', () => {
  it('returns orange-facing Trait labels from authoritative side', () => {
    assert.equal(sideToMoveLabel('w'), 'Trait aux Blancs');
    assert.equal(sideToMoveLabel('b'), 'Trait aux Noirs');
  });
});

describe('vision UX opt-ins', () => {
  it('opts mental / nommer / jouer boards into wide sizing', () => {
    for (const file of ['mental.tsx', 'nommer.tsx', 'jouer.tsx']) {
      const src = readFileSync(join(vizDir, file), 'utf8');
      assert.match(src, /useBoardSize\('wide'\)/);
      assert.match(src, /sizeMode=["']wide["']/);
    }
  });

  it('keeps microphone on mental questions and nommer', () => {
    const mental = readFileSync(join(vizDir, 'mental.tsx'), 'utf8');
    const nommer = readFileSync(join(vizDir, 'nommer.tsx'), 'utf8');
    assert.match(mental, /GameMicButton/);
    assert.match(mental, /mental-mic/);
    assert.match(nommer, /GameMicButton/);
    assert.match(nommer, /nommer-mic/);
    assert.doesNotMatch(nommer, /BooleanSettingRow|Réponse vocale/);
  });

  it('hides live score during mental questioning UI', () => {
    const mental = readFileSync(join(vizDir, 'mental.tsx'), 'utf8');
    assert.doesNotMatch(mental, /Score \$\{snap\.score\}/);
    assert.match(mental, /mental-question-progress/);
    assert.match(mental, /mental-final-score/);
    assert.match(mental, /NumberedSanRows/);
    assert.match(mental, /DiscreteSlider/);
  });

  it('shows Trait aux under boards with primary accent', () => {
    const mental = readFileSync(join(vizDir, 'mental.tsx'), 'utf8');
    const nommer = readFileSync(join(vizDir, 'nommer.tsx'), 'utf8');
    const jouer = readFileSync(join(vizDir, 'jouer.tsx'), 'utf8');
    assert.match(mental, /mental-side-to-move/);
    assert.match(nommer, /nommer-side-to-move/);
    assert.match(jouer, /jouer-side-to-move/);
    assert.match(mental, /colors\.primary/);
    assert.match(nommer, /colors\.primary/);
    assert.match(jouer, /colors\.primary/);
  });
});
