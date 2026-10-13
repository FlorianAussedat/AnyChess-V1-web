import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exactUserDtm, resetElementaryTables, studyElementaryTables } from '../exactElementary.ts';

describe('exact elementary tables', () => {
  it('does not grade from the disabled retrograde', () => {
    resetElementaryTables();
    assert.equal(exactUserDtm('7k/6Q1/6K1/8/8/8/8/8 w - - 0 1', 'w'), null);
    assert.equal(exactUserDtm('k7/8/8/8/8/8/8/K6Q w - - 0 1', 'w'), null);
    const study = studyElementaryTables();
    assert.equal(study.every((row) => row.enabled === false), true);
    const kqk = study.find((row) => row.family === 'kqk');
    assert.equal(kqk?.bytes, 524288);
    resetElementaryTables();
    assert.equal(exactUserDtm('7k/6Q1/6K1/8/8/8/8/8 w - - 0 1', 'w'), null);
  });
});
