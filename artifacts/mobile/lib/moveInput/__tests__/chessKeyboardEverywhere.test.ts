/**
 * Chess-move vs free-text keyboard architecture contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isChessMoveInput, type AnswerInputType } from '../answerInputType.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('AnswerInputType', () => {
  it('distinguishes chess-move from free-text', () => {
    const move: AnswerInputType = 'chess-move';
    const text: AnswerInputType = 'free-text';
    assert.equal(isChessMoveInput(move), true);
    assert.equal(isChessMoveInput(text), false);
  });
});

describe('shared ChessMoveInput / ChessMoveKeypad', () => {
  it('keeps a single keypad implementation with soft-keyboard disabled on chess fields', () => {
    const input = read('components/game/ChessMoveInput.tsx');
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    const freeText = read('components/ChessAnswerInput.tsx');

    assert.match(input, /ChessMoveKeypad/);
    assert.match(input, /showSoftInputOnFocus=\{false\}/);
    assert.match(input, /inputType/);
    assert.match(input, /chess-move/);
    assert.match(keypad, /PromotionPicker/);
    assert.match(keypad, /moveKeypadPiecesForNotation/);
    assert.match(freeText, /showSoftInputOnFocus/);
    assert.match(freeText, /free-text/);
  });
});

describe('modes migrated to chess-move keyboard', () => {
  it('wires ChessMoveInput into SAN answer surfaces', () => {
    const files = [
      'components/OpeningGameScreen.tsx',
      'components/puzzles/PuzzlePlayingPhase.tsx',
      'components/blind/BlindRecitationPhase.tsx',
      'components/blind/BlindReconstructionPhase.tsx',
      'app/openings/continue.tsx',
      'app/quiz-ouverture/construis.tsx',
      'app/visualisation/nommer.tsx',
    ];
    for (const file of files) {
      const src = read(file);
      assert.match(src, /ChessMoveInput/, file);
      assert.doesNotMatch(src, /ChessAnswerInput/, file);
    }
  });

  it('keeps Classic on the shared ChessMoveKeypad (auto-submit)', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /ChessMoveKeypad/);
    assert.match(classic, /autoSubmit/);
    assert.match(classic, /fen=\{keypadFen\}/);
  });
});

describe('modes intentionally left on native free-text keyboard', () => {
  it('keeps opening-name and mixed mental answers on ChessAnswerInput', () => {
    const quelle = read('app/quiz-ouverture/quelle.tsx');
    const mental = read('app/visualisation/mental.tsx');
    assert.match(quelle, /ChessAnswerInput/);
    assert.match(quelle, /inputType="free-text"/);
    assert.doesNotMatch(quelle, /ChessMoveInput/);
    assert.match(mental, /ChessAnswerInput/);
    assert.match(mental, /inputType="free-text"/);
    assert.doesNotMatch(mental, /ChessMoveInput/);
  });
});
