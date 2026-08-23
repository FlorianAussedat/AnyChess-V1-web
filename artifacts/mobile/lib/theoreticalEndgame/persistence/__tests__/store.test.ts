/**
 * TheoreticalEndgameStore persistence + v1→v2 migration tests.
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
  migrateTheoreticalStore,
  loadTheoreticalStore,
} from '../TheoreticalEndgameStore.ts';
import type { TheoreticalAttemptResult } from '../../domain/types.ts';

function sampleResult(
  overrides: Partial<TheoreticalAttemptResult> = {},
): TheoreticalAttemptResult {
  return {
    outcome: 'success',
    positionId: 'TE-CANON-QUEEN-MATE',
    themeId: 'queen-mate',
    objective: 'WIN',
    playerColor: 'white',
    userMoves: 8,
    targetUserMoves: 10,
    attemptScore: 10,
    firstTheoreticalLoss: null,
    startFen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    endFen: '8/8/8/4k3/8/8/8/4K2Q w - - 0 1',
    moveSans: ['Qc6'],
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
    await storage.setItem('anychess.theoreticalEndgame.v2', '{not-json');
    assert.equal(await getCatalogView(), 'cards');
  });

  it('getAllThemeScores returns recorded themes', async () => {
    await recordAttempt(sampleResult());
    const scores = await getAllThemeScores();
    assert.equal(scores['queen-mate']?.score, 10);
  });

  it('migrates v1 keeping catalogView and clearing legacy attempts', () => {
    const migrated = migrateTheoreticalStore({
      version: 1,
      catalogView: 'list',
      themeAttempts: {
        'queen-mate': [
          {
            positionId: 'TE-001',
            themeId: 'queen-mate',
            outcome: 'success',
            userMoves: 8,
            targetUserMoves: 10,
            attemptScore: 10,
            finishedAt: '2026-01-01',
          },
        ],
        'three-pawns': [],
      },
      lastPositionByTheme: { 'queen-mate': 'TE-001' },
      bestByPosition: { 'TE-001': { userMoves: 8, attemptScore: 10 } },
    });
    assert.equal(migrated.version, 2);
    assert.equal(migrated.catalogView, 'list');
    assert.deepEqual(migrated.themeAttempts, {});
    assert.deepEqual(migrated.lastPositionByTheme, {});
    assert.deepEqual(migrated.bestByPosition, {});
    assert.equal(migrated.migratedFromV1, true);
  });

  it('migration is idempotent', () => {
    const once = migrateTheoreticalStore({
      version: 1,
      catalogView: 'list',
      themeAttempts: {},
      lastPositionByTheme: {},
      bestByPosition: {},
    });
    const twice = migrateTheoreticalStore(once);
    assert.equal(twice.catalogView, 'list');
    assert.equal(twice.version, 2);
  });

  it('loads v1 key and writes v2 without AsyncStorage.clear', async () => {
    const storage = new MemoryKeyValueStorage();
    await storage.setItem(
      'anychess.theoreticalEndgame.v1',
      JSON.stringify({
        version: 1,
        catalogView: 'list',
        themeAttempts: {
          lucena: [
            {
              positionId: 'TE-037',
              themeId: 'lucena',
              outcome: 'success',
              userMoves: 10,
              targetUserMoves: 10,
              attemptScore: 10,
              finishedAt: '2026-01-01',
            },
          ],
        },
        lastPositionByTheme: { lucena: 'TE-037' },
        bestByPosition: {},
      }),
    );
    configureTheoreticalStoreStorage(storage);
    clearTheoreticalStoreCache();
    const store = await loadTheoreticalStore();
    assert.equal(store.catalogView, 'list');
    assert.equal(Object.keys(store.themeAttempts).length, 0);
    const v2 = await storage.getItem('anychess.theoreticalEndgame.v2');
    assert.ok(v2);
    assert.equal(await getCatalogView(), 'list');
  });
});
