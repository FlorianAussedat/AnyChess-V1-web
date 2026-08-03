import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORDS_CATEGORIES,
  listRecordsCategoryIds,
} from '../recordsCatalog.ts';

describe('AnyChessRecords catalog', () => {
  it('only lists categories that already persist scores in the app', () => {
    assert.deepEqual(listRecordsCategoryIds(), ['tactics', 'move-naming']);
    assert.equal(RECORDS_CATEGORIES.length, 2);
    for (const cat of RECORDS_CATEGORIES) {
      assert.ok(cat.label.trim());
      assert.ok(cat.description.trim());
    }
  });

  it('does not invent Blind / Classic / Quiz record categories', () => {
    const ids = listRecordsCategoryIds();
    assert.equal(ids.includes('blind' as never), false);
    assert.equal(ids.includes('classic' as never), false);
    assert.equal(ids.includes('quiz' as never), false);
  });
});
