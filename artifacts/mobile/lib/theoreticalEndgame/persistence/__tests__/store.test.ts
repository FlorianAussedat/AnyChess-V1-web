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
  getThemeAttempts,
  updateAttemptGrade,
  mergeTheoreticalDocuments,
} from '../TheoreticalEndgameStore.ts';
import { averageLegacyScore } from '../../domain/comprehensionScore.ts';
import type { TheoreticalAttemptResult } from '../../domain/types.ts';

function sampleResult(
  overrides: Partial<TheoreticalAttemptResult> = {},
): TheoreticalAttemptResult {
  return {
    outcome: 'success',
    positionId: 'TE-CANON-QUEEN-MATE',
    themeId: 'queen-mate',
    objective: 'WIN',
    objectiveKind: 'mate',
    playerColor: 'white',
    userMoves: 8,
    scoreScale: 'quality-5',
    attemptScore: 5,
    quality: null,
    durationMs: 1000,
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
    assert.equal(delta.newScore, 5);
    assert.equal(delta.count, 1);

    const { score, count } = await getThemeComprehension('queen-mate');
    assert.equal(score, 5);
    assert.equal(count, 1);
  });

  it('ignores abandoned attempts in score', async () => {
    await recordAttempt(sampleResult({ outcome: 'success', attemptScore: 5 }));
    await recordAttempt(
      sampleResult({ outcome: 'abandoned', userMoves: 0, attemptScore: null, finishedAt: 'other' }),
    );
    const { count, score } = await getThemeComprehension('queen-mate');
    assert.equal(count, 1);
    assert.equal(score, 5);
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
    assert.equal(scores['queen-mate']?.score, 5);
  });

  it('keeps a pre-update /10 attempt as legacy and out of the /5 average', () => {
    const migrated = migrateTheoreticalStore({
      version: 2,
      datasetVersion: '2.0.0',
      catalogView: 'cards',
      themeAttempts: {
        'queen-mate': [
          {
            positionId: 'TE-CANON-QUEEN-MATE',
            themeId: 'queen-mate',
            outcome: 'success',
            userMoves: 8,
            targetUserMoves: 10,
            attemptScore: 8,
            finishedAt: '2026-01-01',
          },
        ],
      },
      lastPositionByTheme: { 'queen-mate': 'TE-CANON-QUEEN-MATE' },
      bestByPosition: { 'TE-CANON-QUEEN-MATE': { userMoves: 8, attemptScore: 8 } },
    });
    const attempts = migrated.themeAttempts['queen-mate']!;
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0]!.scoreScale, 'legacy-10');
    assert.equal(attempts[0]!.attemptScore, 8);
    assert.equal(averageLegacyScore(attempts).score, 8);
    assert.equal(migrated.bestByPosition['TE-CANON-QUEEN-MATE'], undefined);
  });

  it('counts a win with no score once, and leaves it out of the average', async () => {
    const delta = await recordAttempt(
      sampleResult({
        attemptScore: null,
        analysisStatus: 'pending',
        gradeConfidence: null,
        finishedAt: '2026-10-12T12:00:00.000Z',
        moveSans: ['Qh7'],
      }),
    );
    assert.equal(delta.count, 0);
    assert.equal(delta.attemptCount, 1);
    assert.equal(delta.winCount, 1);
    assert.equal(delta.attemptScore, null);
    await recordAttempt(
      sampleResult({
        attemptScore: null,
        analysisStatus: 'pending',
        finishedAt: '2026-10-12T12:00:00.000Z',
      }),
    );
    const summary = await getThemeComprehension('queen-mate');
    assert.equal(summary.count, 0);
    assert.equal(summary.attemptCount, 1);
    assert.equal(summary.winCount, 1);
    const stored = await getThemeAttempts('queen-mate');
    assert.equal(stored.length, 1);
    assert.deepEqual(stored[0]!.moveSans, ['Qh7']);
    const graded = await updateAttemptGrade('queen-mate', 'TE-CANON-QUEEN-MATE', '2026-10-12T12:00:00.000Z', {
      attemptScore: 4,
      analysisStatus: 'estimated',
      gradeConfidence: 'estimated',
      gradeCursor: 1,
    });
    assert.equal(graded?.attemptScore, 4);
    const after = await getThemeComprehension('queen-mate');
    assert.equal(after.count, 0);
    assert.equal(after.estimatedCount, 1);
    assert.equal(after.estimatedScore, 4);
    assert.equal(after.attemptCount, 1);
    assert.equal((await getThemeAttempts('queen-mate')).length, 1);
  });

  it('merges a stored win with a partial grade instead of dropping either', () => {
    const local = {
      version: 2,
      datasetVersion: '2.0.0',
      catalogView: 'cards',
      themeAttempts: {
        'queen-mate': [
          {
            positionId: 'TE-CANON-QUEEN-MATE',
            themeId: 'queen-mate',
            outcome: 'success',
            userMoves: 1,
            scoreScale: 'quality-5',
            attemptScore: null,
            finishedAt: '2026-10-12T12:00:00.000Z',
            analysisStatus: 'pending',
            gradeCursor: 1,
            moveSans: ['Qh7'],
          },
        ],
      },
      lastPositionByTheme: {},
      bestByPosition: {},
    };
    const remote = {
      ...local,
      themeAttempts: {
        'queen-mate': [
          {
            ...local.themeAttempts['queen-mate'][0],
            gradeCursor: 0,
            moveSans: ['Qh7'],
          },
          {
            positionId: 'TE-CANON-QUEEN-MATE',
            themeId: 'queen-mate',
            outcome: 'theoretical-loss',
            userMoves: 2,
            scoreScale: 'quality-5',
            attemptScore: 0,
            finishedAt: '2026-10-12T13:00:00.000Z',
            analysisStatus: 'not-needed',
          },
        ],
      },
    };
    const merged = mergeTheoreticalDocuments(local, remote);
    const attempts = merged.themeAttempts['queen-mate']!;
    assert.equal(attempts.length, 2);
    const pending = attempts.find((attempt) => attempt.finishedAt.endsWith('12:00:00.000Z'));
    assert.equal(pending?.gradeCursor, 1);
    assert.equal(pending?.attemptScore, null);
  });

  it('records a result only once', async () => {
    const once = sampleResult({ finishedAt: '2026-10-12T00:00:00.000Z' });
    await recordAttempt(once);
    await recordAttempt(once);
    const { count } = await getThemeComprehension('queen-mate');
    assert.equal(count, 1);
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
