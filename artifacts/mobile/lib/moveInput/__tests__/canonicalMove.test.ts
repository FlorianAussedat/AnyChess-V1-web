/**
 * Canonical move helpers shared by touch, text and voice inputs.
 *
 * Run via package.json `test` script.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sameCanonicalMove,
  shouldEmitMoveRecognizedFeedback,
  type CanonicalMove,
} from '../canonicalMove.ts';

describe('shouldEmitMoveRecognizedFeedback', () => {
  it('is true for voice and text only', () => {
    assert.equal(shouldEmitMoveRecognizedFeedback('voice'), true);
    assert.equal(shouldEmitMoveRecognizedFeedback('text'), true);
    assert.equal(shouldEmitMoveRecognizedFeedback('touch'), false);
    assert.equal(shouldEmitMoveRecognizedFeedback('mouse'), false);
  });
});

describe('sameCanonicalMove', () => {
  const base: CanonicalMove = {
    from: 'e2',
    to: 'e4',
    source: 'touch',
  };

  it('matches same from/to regardless of source', () => {
    assert.equal(
      sameCanonicalMove(base, { from: 'e2', to: 'e4', source: 'voice', san: 'e4' }),
      true,
    );
  });

  it('defaults missing promotion to queen', () => {
    assert.equal(
      sameCanonicalMove(
        { from: 'e7', to: 'e8', source: 'text' },
        { from: 'e7', to: 'e8', promotion: 'q', source: 'touch' },
      ),
      true,
    );
  });

  it('distinguishes different promotion pieces', () => {
    assert.equal(
      sameCanonicalMove(
        { from: 'e7', to: 'e8', promotion: 'q', source: 'voice' },
        { from: 'e7', to: 'e8', promotion: 'n', source: 'touch' },
      ),
      false,
    );
  });

  it('rejects different squares', () => {
    assert.equal(
      sameCanonicalMove(base, { from: 'e2', to: 'e3', source: 'mouse' }),
      false,
    );
    assert.equal(
      sameCanonicalMove(base, { from: 'd2', to: 'e4', source: 'mouse' }),
      false,
    );
  });
});
