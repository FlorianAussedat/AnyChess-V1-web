/**
 * TheoreticalEndgameStore persistence tests.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { MemoryKeyValueStorage } from '../../../storage/KeyValueStorage.ts';
import {
  configureTheoreticalStoreStorage,
  clearTheoreticalStoreCache,
  getCatalogView,
  setCatalogView,
  recordAttempt,
  getThemeComprehension,
  getAllThemeScores,
} from '../TheoreticalEndgameStore.ts';
import type { TheoreticalAttemptResult } from '../../domain/types.ts';

function sampleResult(
  overrides: Partial<TheoreticalAttemptResult> = {},
): TheoreticalAttemptResult {
  return {
    outcome: 'success',
    positionId: 'TE-001',
    themeId: 'queen-mate',
    objective: 'WIN',
    playerColor: 'white',
    userMoves: 8,
    targetUserMoves: 10,
    attemptScore: 10,
    firstTheoreticalLoss: null,
    startFen: '8/8/8/8/8/5k2/8/6KQ w - - 0 1',
    endFen: '8/8/8/8/8/5k2/8/6KQ w - - 0 1',
    moveSans: ['Qf7'],
    finishedAt: new Date().toISOString(),
    offScore: false,
    ...overrides,
  };
}

describe('TheoreticalEndgameStore', () => {
  beforeEach(() => {
    configureTheoreticalStoreStorage(new MemoryKeyValueStorage());
    clearTheoreticalStoreCache();
  });

  it('defaults catalog view to cards', async () => {
    assert.equal(await getCatalogView(), 'cards');
  });

  it('persists catalog view preference', async () => {
    await setCatalogView('list');
    assert.equal(await getCatalogView(), 'list');
  });

  it('records attempts and recalculates score', async () => {
    const delta = await recordAttempt(sampleResult());
    assert.equal(delta.newScore, 10);
    assert.equal(delta.count, 1);

    const { score, count } = await getThemeComprehension('queen-mate');
    assert.equal(score, 10);
    assert.equal(count, 1);
  });

  it('ignores abandoned attempts in score', async () => {
    await recordAttempt(sampleResult({ outcome: 'success', attemptScore: 10 }));
    await recordAttempt(
      sampleResult({ outcome: 'abandoned', userMoves: 0, attemptScore: 0 }),
    );
    const { count, score } = await getThemeComprehension('queen-mate');
    assert.equal(count, 1);
    assert.equal(score, 10);
  });

  it('restores safely from corrupted JSON', async () => {
    const storage = new MemoryKeyValueStorage();
    configureTheoreticalStoreStorage(storage);
    clearTheoreticalStoreCache();
    await storage.setItem('anychess.theoreticalEndgame.v1', '{not-json');
    assert.equal(await getCatalogView(), 'cards');
  });

  it('getAllThemeScores returns recorded themes', async () => {
    await recordAttempt(sampleResult());
    const scores = await getAllThemeScores();
    assert.equal(scores['queen-mate']?.score, 10);
  });
});
