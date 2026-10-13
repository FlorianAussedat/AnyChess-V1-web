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

  it('documents defects of this builder, not that a local table is impossible', () => {
    resetElementaryTables();
    const study = studyElementaryTables();
    const kqk = study.find((row) => row.family === 'kqk');
    const kpk = study.find((row) => row.family === 'kpk');
    const kbbk = study.find((row) => row.family === 'kbbk');
    const corner = exactUserDtm('k7/8/8/8/8/8/8/K6Q w - - 0 1', 'w', true);
    const catalogKpk = exactUserDtm('8/8/8/4k3/8/3K4/4P3/8 w - - 0 1', 'w', true);
    assert.equal(corner, 1, 'this unmove graph labels a non-mate-in-1 as 1');
    assert.equal(catalogKpk, null, 'this KPK builder misses the catalog win');
    assert.ok((kqk?.maxDtm ?? 0) <= 10, 'stored KQK max is truncated versus ~19');
    assert.equal(kqk?.bytes, 524288);
    assert.ok((kqk?.buildMs ?? 0) < 5000, 'KQK size and build time are feasible if the graph is correct');
    assert.equal(kpk?.enabled, false);
    assert.equal(kbbk?.enabled, false);
    assert.equal(kbbk?.bytes, 8_388_608);
    assert.match(kbbk?.note ?? '', /8 Mo/);
    resetElementaryTables();
    assert.equal(exactUserDtm('k7/8/8/8/8/8/8/K6Q w - - 0 1', 'w'), null);
  });
});
