/**
 * History cap, independent stars, migration, and cloud merge.
 * Memory storage only — this does not exercise Android AsyncStorage or Stockfish.
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../../storage/KeyValueStorage.ts';
import { StorageKeys } from '../../../storage/StorageKeys.ts';
import { mergeDocumentPayload } from '../../../cloud/mergeDocuments.ts';
import type { AttemptResult } from '../../domain/types.ts';
import { getPositionById } from '../../selection/selectors.ts';
import {
  applyUnstarChoice,
  defendDrawFavoriteId,
  DEFEND_DRAW_HISTORY_LIMIT,
} from '../defendDrawReview.ts';
import {
  clearEndgameStoreCache,
  configureEndgameStoreStorage,
  getDefendDrawHistoryAttempt,
  getFinishedIds,
  isDefendDrawStarred,
  listDefendDrawFavorites,
  listDefendDrawHistory,
  loadEndgameStore,
  recordFinishedAttempt,
  starDefendDrawPosition,
  unstarDefendDrawPosition,
} from '../EndgameTrainingStore.ts';

const INITIAL = '8/8/8/4k3/3p2K1/p5P1/8/4N3 w - - 0 45';
const MIDGAME = '8/8/8/4k3/3p2K1/p5P1/8/4N3 w - - 1 46';
const POOL_ID = 'ET-LP-03ED26D4';

function attempt(
  id: string,
  finishedAt: string | undefined,
  outcome: AttemptResult['outcome'] = 'loss',
): AttemptResult {
  return {
    attemptId: id,
    outcome,
    movesResisted: 3,
    timeline: [{ afterPlayerMove: 0, playerMoveNumber: 45, fen: INITIAL, scoreCp: 0, mateIn: null }],
    moveSans: ['Nd3+'],
    startFen: INITIAL,
    endFen: MIDGAME,
    positionId: POOL_ID,
    positionSnapshot: {
      positionId: POOL_ID,
      initialFen: INITIAL,
      playerColor: 'white',
      datasetContentVersion: 'test',
    },
    finishedAt: finishedAt ?? '',
    fenBeforeLoss: INITIAL,
    losingSan: 'Nd3+',
    evalBeforeLossCp: 0,
    evalAfterLossCp: -250,
    drawAlternatives: [{ san: 'Nf3', scoreCp: -20 }],
    drawAlternativesReliable: true,
  };
}

describe('defend-draw history and favorites', () => {
  beforeEach(() => {
    configureEndgameStoreStorage(new MemoryKeyValueStorage());
    clearEndgameStoreCache();
  });

  it('keeps ten attempts and evicts only the oldest on the eleventh', async () => {
    for (let i = 0; i < 11; i += 1) {
      await recordFinishedAttempt(
        attempt(`id-${String(i).padStart(2, '0')}`, `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
      );
    }
    const history = await listDefendDrawHistory();
    assert.equal(history.length, DEFEND_DRAW_HISTORY_LIMIT);
    assert.equal(history.some((row) => row.id === 'id-00'), false);
    assert.equal(history[0]?.id, 'id-10');
    assert.equal(history.at(-1)?.id, 'id-01');
    const store = await loadEndgameStore();
    assert.ok(store.finishedIds.includes(POOL_ID));
    assert.ok(store.statsByPosition[POOL_ID]);
  });

  it('orders equal dates by attempt id descending', async () => {
    await recordFinishedAttempt(attempt('id-01', '2026-04-01T00:00:00.000Z'));
    await recordFinishedAttempt(attempt('id-02', '2026-04-01T00:00:00.000Z'));
    const history = await listDefendDrawHistory();
    assert.deepEqual(history.map((row) => row.id), ['id-02', 'id-01']);
  });

  it('does not record twice for the same attempt id', async () => {
    const row = attempt('same', '2026-05-01T00:00:00.000Z');
    await recordFinishedAttempt(row);
    await recordFinishedAttempt(row);
    const history = await listDefendDrawHistory();
    assert.equal(history.length, 1);
    const store = await loadEndgameStore();
    assert.equal(store.statsByPosition[POOL_ID]?.attemptsFinished, 1);
  });

  it('keeps an interruption out of finished results and ignores an in-progress row', async () => {
    await recordFinishedAttempt(attempt('live', undefined, 'in-progress'));
    await recordFinishedAttempt(attempt('stop', '2026-06-01T00:00:00.000Z', 'abandoned'));
    const history = await listDefendDrawHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]?.outcome, 'abandoned');
    assert.equal(history[0]?.finishedAt, '2026-06-01T00:00:00.000Z');
    const finished = await getFinishedIds();
    assert.equal(finished.has(POOL_ID), false);
  });

  it('stars the initial position once, from any attempt, and keeps it after history eviction', async () => {
    const catalog = getPositionById(POOL_ID);
    assert.ok(catalog);
    await starDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog!.fen,
    });
    await starDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog!.fen,
    });
    await recordFinishedAttempt(attempt('later', '2026-07-02T00:00:00.000Z'));
    await starDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: catalog!.defender,
      initialFen: MIDGAME,
    });
    let favorites = await listDefendDrawFavorites();
    assert.equal(favorites.length, 1);
    assert.equal(favorites[0]?.initialFen, catalog!.fen);
    const sameConditions = favorites.filter((favorite) => favorite.initialFen === catalog!.fen);
    assert.equal(sameConditions.length, 1);
    assert.equal(
      sameConditions[0]?.id,
      defendDrawFavoriteId(POOL_ID, 'white', catalog!.fen),
    );

    for (let i = 0; i < 11; i += 1) {
      await recordFinishedAttempt(
        attempt(`evict-${String(i).padStart(2, '0')}`, `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`),
      );
    }
    favorites = await listDefendDrawFavorites();
    const kept = favorites.find((favorite) => favorite.initialFen === catalog!.fen);
    assert.ok(kept);
    assert.equal(new Chess(kept!.initialFen).fen(), new Chess(catalog!.fen).fen());
    assert.equal(await isDefendDrawStarred(POOL_ID, 'white', catalog!.fen), true);
    const history = await listDefendDrawHistory();
    assert.equal(history.some((row) => row.id === 'later'), false);
  });

  it('removes a favorite only after confirmation and leaves a recent attempt', async () => {
    const catalog = getPositionById(POOL_ID)!;
    await starDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog.fen,
    });
    await recordFinishedAttempt(attempt('recent', '2026-09-01T00:00:00.000Z'));
    const before = await listDefendDrawFavorites();
    const historyBefore = await listDefendDrawHistory();
    const cancelled = applyUnstarChoice(before, historyBefore, before[0]!.id, 'cancel');
    assert.equal(cancelled.favorites.length, 1);
    assert.equal(cancelled.history.length, 1);

    await unstarDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog.fen,
    });
    assert.equal((await listDefendDrawFavorites()).length, 0);
    assert.equal((await listDefendDrawHistory()).length, 1);
    assert.equal((await getDefendDrawHistoryAttempt('recent'))?.initialFen, INITIAL);
  });

  it('unstar does not wipe another stored document', async () => {
    const storage = new MemoryKeyValueStorage();
    configureEndgameStoreStorage(storage);
    clearEndgameStoreCache();
    await storage.setItem('anychess.other.library', '{"games":[1]}');
    const catalog = getPositionById(POOL_ID)!;
    await starDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog.fen,
    });
    await unstarDefendDrawPosition({
      positionId: POOL_ID,
      playerColor: 'white',
      initialFen: catalog.fen,
    });
    assert.equal(await storage.getItem('anychess.other.library'), '{"games":[1]}');
    const store = await loadEndgameStore();
    assert.equal(store.favorites.length, 0);
    assert.ok(store.favoriteTombstones.length >= 1);
  });

  it('migrates Essaie encore ids into starred finales without inventing a result', async () => {
    const storage = new MemoryKeyValueStorage();
    configureEndgameStoreStorage(storage);
    clearEndgameStoreCache();
    const catalog = getPositionById(POOL_ID)!;
    await storage.setItem(
      StorageKeys.endgameTrainingV2.key,
      JSON.stringify({
        version: 2,
        datasetVersion: '3.0.0',
        tryAgainIds: [POOL_ID, POOL_ID, 'DD-NOT-A-POSITION'],
        finishedIds: [POOL_ID],
        statsByPosition: {
          [POOL_ID]: { positionId: POOL_ID, attemptsFinished: 2, recent: [] },
        },
        showGauge: false,
        recentFamilies: ['pawn'],
        recentSignatures: [],
      }),
    );
    const store = await loadEndgameStore();
    assert.equal(store.favorites.length, 1);
    assert.equal(store.favorites[0]?.initialFen, catalog.fen);
    assert.equal(store.favorites[0]?.playerColor, catalog.defender);
    assert.equal(store.favorites[0]?.starredAt, undefined);
    assert.equal(store.history.length, 0);
    assert.equal(store.showGauge, false);
    assert.deepEqual(store.finishedIds, [POOL_ID]);
    assert.equal(store.statsByPosition[POOL_ID]?.attemptsFinished, 2);
    clearEndgameStoreCache();
    const again = await loadEndgameStore();
    assert.equal(again.favorites.length, 1);
    assert.equal(again.history.length, 0);
  });
});

describe('defend-draw cloud merge', () => {
  it('caps history at ten, keeps an evicted favorite, and does not resurrect a removal', () => {
    const catalog = getPositionById(POOL_ID)!;
    const favorite = {
      id: defendDrawFavoriteId(POOL_ID, 'white', catalog.fen),
      positionId: POOL_ID,
      initialFen: catalog.fen,
      playerColor: 'white' as const,
      sideToMove: 'w' as const,
      starredAt: '2026-01-01T00:00:00.000Z',
    };
    const localHistory = Array.from({ length: 6 }, (_, i) => ({
      id: `local-${i}`,
      positionId: POOL_ID,
      initialFen: catalog.fen,
      playerColor: 'white',
      sideToMove: 'w',
      moveSans: [],
      outcome: 'loss',
      movesResisted: i,
      finishedAt: `2026-03-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      endFen: catalog.fen,
      timeline: [],
    }));
    const remoteHistory = Array.from({ length: 6 }, (_, i) => ({
      id: `remote-${i}`,
      positionId: POOL_ID,
      initialFen: catalog.fen,
      playerColor: 'white',
      sideToMove: 'w',
      moveSans: [],
      outcome: 'win-30-moves',
      movesResisted: 30,
      finishedAt: `2026-04-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      endFen: catalog.fen,
      timeline: [],
    }));
    const local = JSON.stringify({
      version: 2,
      favorites: [favorite],
      history: localHistory,
      finishedIds: ['keep-local'],
      statsByPosition: { 'keep-local': { attemptsFinished: 4, lastFinishedAt: '2026-03-01T00:00:00.000Z' } },
      showGauge: true,
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    const remote = JSON.stringify({
      version: 2,
      favorites: [favorite],
      history: remoteHistory,
      finishedIds: ['keep-remote'],
      statsByPosition: { 'keep-remote': { attemptsFinished: 1, lastFinishedAt: '2026-04-01T00:00:00.000Z' } },
      showGauge: true,
      updatedAt: '2026-05-02T00:00:00.000Z',
    });
    const merged = JSON.parse(
      mergeDocumentPayload(StorageKeys.endgameTrainingV2.key, local, remote) ?? '{}',
    ) as {
      history: { id: string }[];
      favorites: { id: string }[];
      finishedIds: string[];
      statsByPosition: Record<string, { attemptsFinished: number }>;
    };
    assert.equal(merged.history.length, 10);
    assert.equal(merged.favorites.length, 1);
    assert.ok(merged.finishedIds.includes('keep-local'));
    assert.ok(merged.finishedIds.includes('keep-remote'));
    assert.equal(merged.statsByPosition['keep-local']?.attemptsFinished, 4);
    assert.equal(merged.history.some((row) => row.id === 'local-0'), false);

    const removed = JSON.stringify({
      version: 2,
      favorites: [],
      favoriteTombstones: [favorite.id],
      favoriteDeletedAt: { [favorite.id]: '2026-06-01T00:00:00.000Z' },
      syncDeletedIds: [favorite.id],
      history: merged.history,
      updatedAt: '2026-06-01T00:00:00.000Z',
    });
    const resurrect = JSON.parse(
      mergeDocumentPayload(StorageKeys.endgameTrainingV2.key, removed, remote) ?? '{}',
    ) as { favorites: { id: string }[]; history: unknown[] };
    assert.equal(resurrect.favorites.length, 0);
    assert.equal(resurrect.history.length, 10);
  });
});
