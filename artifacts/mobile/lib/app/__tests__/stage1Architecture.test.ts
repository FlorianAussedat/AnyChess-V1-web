import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { APP_NAME, APP_STAGE, APP_VERSION, formatAppVersionLabel } from '../version.ts';
import {
  DEFAULT_PLAYER_DIFFICULTY,
  recommendedBlindFullMoves,
  recommendedPuzzleRatingRange,
  recommendedStockfishElo,
} from '../../difficulty/PlayerDifficultyProfile.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';

describe('app version', () => {
  it('formats the beta display label from one source of truth', () => {
    assert.equal(formatAppVersionLabel(), 'AnyChess Beta 0.0.0.1');
    assert.equal(APP_NAME, 'AnyChess');
    assert.equal(APP_STAGE, 'Beta');
    assert.equal(APP_VERSION, '0.0.0.1');
  });

  it('updates when constants change without hardcoding in the assertion of structure', () => {
    assert.equal(
      formatAppVersionLabel('X', 'Alpha', '1.2.3'),
      'X Alpha 1.2.3',
    );
  });
});

describe('PlayerDifficultyProfile defaults', () => {
  it('keeps the ~1800 Chess.com design target', () => {
    assert.equal(DEFAULT_PLAYER_DIFFICULTY.estimatedChessComElo, 1800);
    assert.equal(recommendedStockfishElo(), 1800);
  });

  it('recommends the historical puzzle band around 1800', () => {
    const range = recommendedPuzzleRatingRange();
    assert.equal(range.ratingMin, 1600);
    assert.equal(range.ratingMax, 2200);
  });

  it('suggests a mid-level blind length for 1800', () => {
    assert.equal(recommendedBlindFullMoves(), 5);
  });
});

describe('MemoryKeyValueStorage', () => {
  it('stores and retrieves values', async () => {
    const store = new MemoryKeyValueStorage();
    assert.equal(await store.getItem('k'), null);
    await store.setItem('k', 'v');
    assert.equal(await store.getItem('k'), 'v');
    await store.removeItem('k');
    assert.equal(await store.getItem('k'), null);
  });
});
