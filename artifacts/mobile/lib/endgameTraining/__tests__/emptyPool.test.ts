/**
 * Runtime pool + persistence migration tests.
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../storage/StorageKeys.ts';
import {
  ENDGAME_TRAINING_POOL,
  ENDGAME_POOL_DATASET_VERSION,
  isRuntimePoolEmpty,
  pickNewPosition,
  pickTryAgainPosition,
  getPositionById,
  loadEndgameStore,
  getTryAgainIds,
  configureEndgameStoreStorage,
  clearEndgameStoreCache,
  sanitizeStoreAgainstPool,
} from '../index.ts';
import {
  LEGACY_RUNTIME_IDS,
  ENDGAME_TEST_FIXTURES,
} from './fixtures/samplePositions.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

describe('runtime pool', () => {
  it('has a non-empty Lichess product pool', () => {
    assert.ok(ENDGAME_TRAINING_POOL.length >= 80);
    assert.equal(isRuntimePoolEmpty(), false);
  });

  it('excludes all 34 legacy runtime ids', () => {
    const ids = new Set(ENDGAME_TRAINING_POOL.map((p) => p.id));
    for (const legacyId of LEGACY_RUNTIME_IDS) {
      assert.equal(ids.has(legacyId), false, legacyId);
    }
  });

  it('does not resolve legacy or fixture ids', () => {
    assert.equal(getPositionById('DD-001'), null);
    assert.equal(getPositionById('FIXTURE-ET-1'), null);
  });

  it('can pick from a populated pool', () => {
    const picked = pickNewPosition(new Set());
    assert.ok(picked);
    assert.match(picked!.id, /^ET-LP-/);
  });

  it('fixtures are not exported from pool.generated.ts', () => {
    const src = readFileSync(
      join(mobileRoot, 'lib/endgameTraining/data/pool.generated.ts'),
      'utf8',
    );
    assert.doesNotMatch(src, /DD-001/);
    assert.doesNotMatch(src, /FIXTURE-ET/);
    for (const fx of ENDGAME_TEST_FIXTURES) {
      assert.doesNotMatch(src, new RegExp(fx.id));
    }
  });
});

describe('persistence migration', () => {
  beforeEach(() => {
    configureEndgameStoreStorage(new MemoryKeyValueStorage());
    clearEndgameStoreCache();
  });

  it('prunes stale try-again ids on load', async () => {
    const storage = new MemoryKeyValueStorage();
    configureEndgameStoreStorage(storage);
    clearEndgameStoreCache();
    await storage.setItem(
      StorageKeys.endgameTrainingV2.key,
      JSON.stringify({
        version: 2,
        datasetVersion: '1.0.0-legacy',
        tryAgainIds: ['DD-001', 'DD-062'],
        finishedIds: ['DD-001'],
        statsByPosition: {
          'DD-001': { positionId: 'DD-001', attemptsFinished: 1 },
        },
        showGauge: true,
        recentFamilies: [],
        recentSignatures: [],
      }),
    );
    await loadEndgameStore();
    assert.deepEqual(await getTryAgainIds(), []);
    const raw = JSON.parse(
      (await storage.getItem(StorageKeys.endgameTrainingV2.key))!,
    ) as { tryAgainIds: string[]; finishedIds: string[]; datasetVersion: string };
    assert.deepEqual(raw.tryAgainIds, []);
    assert.deepEqual(raw.finishedIds, []);
    assert.equal(raw.datasetVersion, ENDGAME_POOL_DATASET_VERSION);
  });

  it('sanitizeStoreAgainstPool keeps stats for removed ids', () => {
    const store = {
      version: 2 as const,
      datasetVersion: '1.0.0',
      tryAgainIds: ['DD-001'],
      finishedIds: ['DD-002'],
      statsByPosition: { 'DD-003': { positionId: 'DD-003' } as never },
      showGauge: true,
      recentFamilies: [],
      recentSignatures: [],
    };
    assert.equal(sanitizeStoreAgainstPool(store), true);
    assert.deepEqual(store.tryAgainIds, []);
    assert.deepEqual(store.finishedIds, []);
    assert.deepEqual(Object.keys(store.statsByPosition), ['DD-003']);
    assert.equal(store.datasetVersion, ENDGAME_POOL_DATASET_VERSION);
  });
});

describe('pipeline write guard', () => {
  it('refuses zero-position pool generation', () => {
    const src = readFileSync(
      join(mobileRoot, 'lib/endgameTraining/pipeline/writeGeneratedPool.ts'),
      'utf8',
    );
    assert.match(src, /positions\.length === 0/);
    assert.match(src, /Refusing to write empty/);
  });
});
