/**
 * Chess move keypad V3 — auto-submit form rules + Classic scope contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendMoveKeypadToken,
  applyMoveKeypadToken,
  backspaceMoveKeypad,
  buildMoveKeypadValue,
  clearMoveKeypad,
  isCompleteMoveKeypadBuffer,
  priorityMoveKeypadKeys,
  trimMoveKeypadBuffer,
} from '../chessMoveKeypad.ts';

const here = dirname(fileURLToPath(import.meta.url));
const classicPath = join(here, '../../../components/ClassicGameScreen.tsx');
const keypadUiPath = join(here, '../../../components/game/ChessMoveKeypad.tsx');
const openingPath = join(here, '../../../components/OpeningGameScreen.tsx');
const puzzlePath = join(here, '../../../components/puzzles/PuzzlePlayingPhase.tsx');

describe('chess move keypad construction', () => {
  it('builds e4, Cf3, Cxf7, Dxh7, castling', () => {
    assert.equal(buildMoveKeypadValue(['e', '4']), 'e4');
    assert.equal(buildMoveKeypadValue(['C', 'f', '3']), 'Cf3');
    assert.equal(buildMoveKeypadValue(['F', 'e', '7']), 'Fe7');
    assert.equal(buildMoveKeypadValue(['D', 'x', 'h', '7']), 'Dxh7');
    assert.equal(buildMoveKeypadValue(['C', 'x', 'f', '7']), 'Cxf7');
    assert.equal(appendMoveKeypadToken('', 'O-O'), 'O-O');
    assert.equal(appendMoveKeypadToken('', 'O-O-O'), 'O-O-O');
  });

  it('trims spaces', () => {
    assert.equal(trimMoveKeypadBuffer('  Cf3  '), 'Cf3');
  });
});

describe('chess move keypad auto-submit readiness', () => {
  it('marks complete moves ready and incomplete not ready', () => {
    assert.equal(isCompleteMoveKeypadBuffer('e4'), true);
    assert.equal(isCompleteMoveKeypadBuffer('Cf3'), true);
    assert.equal(isCompleteMoveKeypadBuffer('Fe7'), true);
    assert.equal(isCompleteMoveKeypadBuffer('Dxh7'), true);
    assert.equal(isCompleteMoveKeypadBuffer('O-O'), true);
    assert.equal(isCompleteMoveKeypadBuffer('O-O-O'), true);

    assert.equal(isCompleteMoveKeypadBuffer('C'), false);
    assert.equal(isCompleteMoveKeypadBuffer('Cx'), false);
    assert.equal(isCompleteMoveKeypadBuffer('e'), false);
    assert.equal(isCompleteMoveKeypadBuffer('Dxh'), false);
    assert.equal(isCompleteMoveKeypadBuffer(''), false);
  });

  it('applyMoveKeypadToken reports readyToSubmit for auto-submit cases', () => {
    assert.deepEqual(applyMoveKeypadToken('e', '4'), { value: 'e4', readyToSubmit: true });
    assert.deepEqual(applyMoveKeypadToken('Cf', '3'), { value: 'Cf3', readyToSubmit: true });
    assert.deepEqual(applyMoveKeypadToken('Fe', '7'), { value: 'Fe7', readyToSubmit: true });
    assert.deepEqual(applyMoveKeypadToken('Dxh', '7'), { value: 'Dxh7', readyToSubmit: true });
    assert.deepEqual(applyMoveKeypadToken('', 'O-O'), { value: 'O-O', readyToSubmit: true });
    assert.deepEqual(applyMoveKeypadToken('', 'O-O-O'), {
      value: 'O-O-O',
      readyToSubmit: true,
    });

    assert.equal(applyMoveKeypadToken('', 'C').readyToSubmit, false);
    assert.equal(applyMoveKeypadToken('C', 'x').readyToSubmit, false);
    assert.equal(applyMoveKeypadToken('', 'e').readyToSubmit, false);
    assert.equal(applyMoveKeypadToken('Dx', 'h').readyToSubmit, false);
  });
});

describe('chess move keypad backspace / clear', () => {
  it('removes last character through Cxf7', () => {
    let v = 'Cxf7';
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cxf');
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cx');
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'C');
    v = backspaceMoveKeypad(v);
    assert.equal(v, '');
  });

  it('clears castling tokens in one backspace', () => {
    assert.equal(backspaceMoveKeypad('O-O'), '');
    assert.equal(backspaceMoveKeypad('O-O-O'), '');
  });

  it('Effacer empties the buffer', () => {
    assert.equal(clearMoveKeypad(), '');
  });
});

describe('chess move keypad contextual priority', () => {
  it('highlights plausible keys without hard locks', () => {
    const empty = priorityMoveKeypadKeys('');
    assert.ok(empty.has('C'));
    assert.ok(empty.has('e'));
    assert.ok(empty.has('O-O'));

    const afterC = priorityMoveKeypadKeys('C');
    assert.ok(afterC.has('f'));
    assert.ok(afterC.has('x'));

    const afterCx = priorityMoveKeypadKeys('Cx');
    assert.ok(afterCx.has('f'));

    const afterCxf = priorityMoveKeypadKeys('Cxf');
    assert.ok(afterCxf.has('7'));

    const afterE = priorityMoveKeypadKeys('e');
    assert.ok(afterE.has('4'));
    assert.ok(afterE.has('x'));
  });
});

describe('classic keypad V3 wiring scope', () => {
  it('uses auto-submit keypad mode without text field or Valider', () => {
    const classic = readFileSync(classicPath, 'utf8');
    const keypadUi = readFileSync(keypadUiPath, 'utf8');

    assert.match(classic, /ChessMoveKeypad/);
    assert.match(classic, /classic-move-keypad/);
    assert.match(classic, /classic-coup-banner/);
    assert.match(classic, /classic-keypad-visibility-toggle/);
    assert.match(classic, /classic-keyboard-mode-toggle/);
    assert.match(classic, /onKeypadAutoSubmit/);
    assert.match(classic, /keypadMode/);
    assert.match(classic, /anyChessKeypadVisible/);
    assert.match(classic, /variant=["']compact["']/);
    // Text field only in system-keyboard fallback.
    assert.match(classic, /useSystemKeyboard \? \(/);
    assert.match(classic, /ChessAnswerInput/);
    // Voice pipeline unchanged.
    assert.match(classic, /onTranscript:/);

    // Keypad UI: no + / # / OK submit key.
    assert.doesNotMatch(keypadUi, /token:\s*'\+'/);
    assert.doesNotMatch(keypadUi, /token:\s*'#'/);
    assert.doesNotMatch(keypadUi, /action:\s*'submit'/);
    assert.doesNotMatch(keypadUi, /label:\s*'OK'/);
    assert.match(keypadUi, /autoSubmit/);
    assert.match(keypadUi, /applyMoveKeypadToken/);

    const opening = readFileSync(openingPath, 'utf8');
    assert.doesNotMatch(opening, /ChessMoveKeypad/);

    const puzzle = readFileSync(puzzlePath, 'utf8');
    assert.doesNotMatch(puzzle, /ChessMoveKeypad/);
  });

  it('keeps system keyboard fallback with visible text input', () => {
    const classic = readFileSync(classicPath, 'utf8');
    assert.match(classic, /Compose ou dicte le coup/);
    assert.match(classic, /onSystemKeyboardSubmit/);
    assert.match(classic, /setUseSystemKeyboard/);
  });
});
