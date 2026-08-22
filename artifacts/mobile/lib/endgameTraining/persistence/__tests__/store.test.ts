/**
 * EndgameTrainingStore — MemoryKeyValueStorage (same idea as PreferencesStore tests).
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { MemoryKeyValueStorage } from '../../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../../storage/StorageKeys.ts';
import type { AttemptResult } from '../../domain/types.ts';
import {
  addToTryAgain,
  clearEndgameStoreCache,
  configureEndgameStoreStorage,
  getFinishedIds,
  getShowGauge,
  getTryAgainIds,
  isInTryAgain,
  loadEndgameStore,
  recordFinishedAttempt,
  removeFromTryAgain,
  resetEndgameStoreStorage,
  setShowGauge,
} from '../EndgameTrainingStore.ts';
import { ENDGAME_POOL_DATASET_VERSION } from '../../data/poolMetadata.ts';

function baseResult(
  partial: Partial<AttemptResult> & { positionId: string; outcome: AttemptResult['outcome'] },
): AttemptResult {
  return {
    movesResisted: 5,
    timeline: [],
    moveSans: [],
    startFen: '8/8/8/8/8/8/8/8 w - - 0 1',
    endFen: '8/8/8/8/8/8/8/8 w - - 0 1',
    finishedAt: '2026-08-20T00:00:00.000Z',
    firstMajorTurn: null,
    ...partial,
  };
}

describe('EndgameTrainingStore', () => {
  beforeEach(() => {
    configureEndgameStoreStorage(new MemoryKeyValueStorage());
    clearEndgameStoreCache();
  });

  it('adds and removes try-again without duplicates', async () => {
    assert.equal(await addToTryAgain('P1'), true);
    assert.equal(await addToTryAgain('P1'), false);
    assert.deepEqual(await getTryAgainIds(), ['P1']);
    assert.equal(await isInTryAgain('P1'), true);
    await removeFromTryAgain('P1');
    assert.equal(await isInTryAgain('P1'), false);
  });

  it('mastery auto-removes from try-again', async () => {
    await addToTryAgain('P2');
    await recordFinishedAttempt(
      baseResult({ positionId: 'P2', outcome: 'win-30-moves', movesResisted: 30 }),
    );
    assert.equal(await isInTryAgain('P2'), false);
    const finished = await getFinishedIds();
    assert.equal(finished.has('P2'), true);
  });

  it('abandon is not recorded as finished', async () => {
    await recordFinishedAttempt(
      baseResult({ positionId: 'P3', outcome: 'abandoned', movesResisted: 2 }),
    );
    const finished = await getFinishedIds();
    assert.equal(finished.has('P3'), false);
  });

  it('toggles gauge preference', async () => {
    assert.equal(await getShowGauge(), true);
    await setShowGauge(false);
    clearEndgameStoreCache();
    assert.equal(await getShowGauge(), false);
  });

  it('uses storage key anychess.endgameTraining.v2', () => {
    assert.equal(StorageKeys.endgameTrainingV2.key, 'anychess.endgameTraining.v2');
  });

  it('tracks dataset version on store', async () => {
    const store = await loadEndgameStore();
    assert.equal(store.datasetVersion, ENDGAME_POOL_DATASET_VERSION);
  });

  it('resetEndgameStoreStorage restores default backend hook', () => {
    resetEndgameStoreStorage();
    clearEndgameStoreCache();
  });
});
