import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotationColumnRows,
  notationScrollIndexForNode,
  parseReaderPgn,
} from '../index.ts';

const SHORT = `[White "W"]
[Black "B"]

1. e4 e5 2. Nf3 Nc6 *`;

const WITH_VARIATION = `[White "W"]
[Black "B"]

1. e4 e5 (1... c5 2. Nf3) 2. Nf3 *`;

describe('buildNotationColumnRows', () => {
  it('pairs main-line moves into columns', () => {
    const result = parseReaderPgn(SHORT);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const rows = buildNotationColumnRows(result.game);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.moveNumber, 1);
    assert.equal(rows[0]!.white?.san, 'e4');
    assert.equal(rows[0]!.black?.san, 'e5');
    assert.equal(rows[1]!.moveNumber, 2);
    assert.equal(rows[1]!.white?.san, 'Nf3');
    assert.equal(rows[1]!.black?.san, 'Nc6');
    assert.equal(rows[0]!.variations.length, 0);
  });

  it('attaches side variations under the ply where they fork', () => {
    const result = parseReaderPgn(WITH_VARIATION);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const rows = buildNotationColumnRows(result.game);
    assert.ok(rows.length >= 1);
    const first = rows[0]!;
    assert.equal(first.white?.san, 'e4');
    assert.equal(first.black?.san, 'e5');
    assert.ok(first.variations.length >= 1);
    const sans = first.variations[0]!.moves.map((m) => m.san);
    assert.ok(sans.includes('c5'));
  });

  it('keeps nested sub-variations as recursive blocks', () => {
    const pgn = `[White "W"]
[Black "B"]

1. e4 e5 (1... c5 2. Nf3 d6 (2... Nc6 3. Bb5)) 2. Nf3 *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const rows = buildNotationColumnRows(result.game);
    const first = rows[0]!;
    assert.ok(first.variations.length >= 1);
    const top = first.variations[0]!;
    assert.ok(top.moves.some((m) => m.san === 'c5'));
    assert.ok(
      top.nested.length >= 1,
      'expected nested variation under 2.Nf3 alternatives',
    );
    assert.ok(top.nested.some((n) => n.moves.some((m) => m.san === 'Nc6')));
  });
});
