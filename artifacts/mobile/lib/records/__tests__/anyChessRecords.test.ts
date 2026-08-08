import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDS_CATEGORIES,
  listRecordsCategoryIds,
} from '../recordsCatalog.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { MoveNamingRecordsStore } from '../../moveNaming/MoveNamingRecords.ts';

describe('AnyChessRecords catalog', () => {
  it('lists categories that persist scores in the app', () => {
    assert.deepEqual(listRecordsCategoryIds(), [
      'tactics',
      'move-naming',
      'play-move',
      'memorisation',
    ]);
    assert.equal(RECORDS_CATEGORIES.length, 4);
    for (const cat of RECORDS_CATEGORIES) {
      assert.ok(cat.labelKey.trim());
      assert.ok(cat.descriptionKey.trim());
    }
  });

  it('includes Mémorisation and does not invent Classic / Quiz categories', () => {
    const ids = listRecordsCategoryIds();
    assert.equal(ids.includes('memorisation'), true);
    assert.equal(ids.includes('classic' as never), false);
    assert.equal(ids.includes('quiz' as never), false);
  });
});

describe('record persistence smoke', () => {
  it('keeps a written Nommer record after a new store instance', async () => {
    const storage = new MemoryKeyValueStorage();
    const a = new MoveNamingRecordsStore(storage);
    await a.saveScore(12);
    const b = new MoveNamingRecordsStore(storage);
    assert.equal(await b.loadBest(), 12);
  });
});
