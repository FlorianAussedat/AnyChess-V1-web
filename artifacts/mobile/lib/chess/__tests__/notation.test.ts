import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSanForDisplay,
  formatNumberedSanForDisplay,
  formatSanLineForDisplay,
  keypadPieceLetters,
  normalizeMoveInputToEnglish,
} from '../notation.ts';

describe('formatSanForDisplay', () => {
  it('keeps English SAN when notation is en', () => {
    assert.equal(formatSanForDisplay('Nf3', 'en'), 'Nf3');
    assert.equal(formatSanForDisplay('Bxe5+', 'en'), 'Bxe5+');
  });

  it('maps English piece letters to French for display', () => {
    assert.equal(formatSanForDisplay('Nf3', 'fr'), 'Cf3');
    assert.equal(formatSanForDisplay('Bxe5', 'fr'), 'Fxe5');
    assert.equal(formatSanForDisplay('O-O', 'fr'), 'O-O');
    assert.equal(formatSanForDisplay('e8=Q', 'fr'), 'e8=D');
    assert.equal(formatSanForDisplay('Rae1', 'fr'), 'Tae1');
    assert.equal(formatSanForDisplay('Kd2', 'fr'), 'Rd2');
  });
});

describe('formatNumberedSanForDisplay / line', () => {
  it('preserves move numbers', () => {
    assert.equal(formatNumberedSanForDisplay('5.Nf3', 'fr'), '5.Cf3');
    assert.equal(formatNumberedSanForDisplay('8...Bg7', 'fr'), '8...Fg7');
  });

  it('formats a multi-move line', () => {
    assert.equal(
      formatSanLineForDisplay('1.Nf3 Nxe5 2.Qh5+', 'fr'),
      '1.Cf3 Cxe5 2.Dh5+',
    );
  });
});

describe('keypadPieceLetters', () => {
  it('returns FR or EN piece rows', () => {
    assert.deepEqual(keypadPieceLetters('fr'), ['C', 'F', 'T', 'D', 'R']);
    assert.deepEqual(keypadPieceLetters('en'), ['N', 'B', 'R', 'Q', 'K']);
  });
});

describe('normalizeMoveInputToEnglish', () => {
  it('converts French piece prefixes for chess.js', () => {
    assert.equal(normalizeMoveInputToEnglish('Cf3'), 'Nf3');
    assert.equal(normalizeMoveInputToEnglish('Fe7'), 'Be7');
  });

  it('leaves English SAN intact', () => {
    assert.equal(normalizeMoveInputToEnglish('Nf3'), 'Nf3');
  });
});
