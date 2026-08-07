import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import {
  PuzzleStreakStore,
  applyStreakResult,
  emptyStreakState,
  PUZZLE_STREAK_STORAGE_KEY,
} from '../PuzzleStreakStore.ts';

describe('applyStreakResult', () => {
  it('increments current and best on solve', () => {
    const next = applyStreakResult(emptyStreakState(), '1600-1800', true);
    assert.equal(next.currentByBand['1600-1800'], 1);
    assert.equal(next.bestByBand['1600-1800'], 1);
  });

  it('resets current on fail without clearing best', () => {
    let state = applyStreakResult(emptyStreakState(), 'all', true);
    state = applyStreakResult(state, 'all', true);
    state = applyStreakResult(state, 'all', true);
    assert.equal(state.currentByBand.all, 3);
    assert.equal(state.bestByBand.all, 3);

    state = applyStreakResult(state, 'all', false);
    assert.equal(state.currentByBand.all, 0);
    assert.equal(state.bestByBand.all, 3);
  });

  it('tracks bands independently', () => {
    let state = applyStreakResult(emptyStreakState(), 'lt800', true);
    state = applyStreakResult(state, 'gt2200', true);
    state = applyStreakResult(state, 'gt2200', true);
    assert.equal(state.currentByBand.lt800, 1);
    assert.equal(state.currentByBand.gt2200, 2);
    assert.equal(state.bestByBand.gt2200, 2);
  });
});

describe('PuzzleStreakStore', () => {
  it('persists via KeyValueStorage and exposes recordResult', async () => {
    const mem = new MemoryKeyValueStorage();
    const store = new PuzzleStreakStore(mem);
    const a = await store.recordResult('800-1000', true);
    assert.deepEqual(a, { current: 1, best: 1 });
    await store.recordResult('800-1000', true);
    const snap = await store.getSnapshot();
    assert.equal(snap.currentByBand['800-1000'], 2);
    assert.equal(snap.bestByBand['800-1000'], 2);

    const raw = await mem.getItem(PUZZLE_STREAK_STORAGE_KEY);
    assert.ok(raw && raw.includes('800-1000'));

    await store.recordResult('800-1000', false);
    const afterFail = await store.getSnapshot();
    assert.equal(afterFail.currentByBand['800-1000'], 0);
    assert.equal(afterFail.bestByBand['800-1000'], 2);

    await store.resetAll();
    const cleared = await store.getSnapshot();
    assert.deepEqual(cleared, emptyStreakState());
  });
});
