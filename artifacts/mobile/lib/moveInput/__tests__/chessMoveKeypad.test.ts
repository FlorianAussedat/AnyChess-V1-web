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

  it('supports English notation piece letters for auto-submit', () => {
    assert.equal(isCompleteMoveKeypadBuffer('Nf3', 'en'), true);
    assert.equal(isCompleteMoveKeypadBuffer('Bxe5', 'en'), true);
    assert.deepEqual(applyMoveKeypadToken('Nf', '3', 'en'), {
      value: 'Nf3',
      readyToSubmit: true,
    });
    assert.equal(applyMoveKeypadToken('', 'N', 'en').readyToSubmit, false);
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

  it('clearMoveKeypad helper still empties the buffer', () => {
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

describe('classic keypad wiring scope', () => {
  it('uses auto-submit keypad with single mode toggle (no Eff / no system field)', () => {
    const classic = readFileSync(classicPath, 'utf8');
    const keypadUi = readFileSync(keypadUiPath, 'utf8');

    assert.match(classic, /ChessMoveKeypad/);
    assert.match(classic, /classic-move-keypad/);
    assert.match(classic, /classic-coup-banner/);
    assert.match(classic, /classic-input-mode-toggle/);
    assert.match(classic, /onKeypadAutoSubmit/);
    assert.match(classic, /inputMode/);
    assert.doesNotMatch(classic, /useSystemKeyboard/);
    assert.doesNotMatch(classic, /ChessAnswerInput/);
    assert.match(classic, /onTranscript:/);

    // Keypad UI: no + / # / OK / Eff clear key.
    assert.doesNotMatch(keypadUi, /token:\s*'\+'/);
    assert.doesNotMatch(keypadUi, /token:\s*'#'/);
    assert.doesNotMatch(keypadUi, /action:\s*'submit'/);
    assert.doesNotMatch(keypadUi, /action:\s*'clear'/);
    assert.doesNotMatch(keypadUi, /label:\s*'OK'/);
    assert.doesNotMatch(keypadUi, /keypad\.clear/);
    assert.match(keypadUi, /autoSubmit/);
    assert.match(keypadUi, /applyMoveKeypadToken/);
    assert.match(keypadUi, /KEYPAD_COLUMNS/);
  });

  it('keeps FR/EN piece letters adaptive via notation preference', () => {
    const keypadUi = readFileSync(keypadUiPath, 'utf8');
    assert.match(keypadUi, /moveKeypadPiecesForNotation/);
    assert.match(keypadUi, /chessNotation/);
  });
});

describe('move sequences on the keypad buffer', () => {
  it('inserts a space when a new move starts after a complete segment', () => {
    assert.equal(buildMoveKeypadValue(['C', 'f', '3', 'C', 'c', '6']), 'Cf3 Cc6');
    assert.equal(buildMoveKeypadValue(['e', '4', 'e', '5']), 'e4 e5');
    assert.equal(appendMoveKeypadToken('Cf3', 'O-O'), 'Cf3 O-O');
  });

  it('backspaces within the last segment of a sequence', () => {
    let v = 'Cf3 Cc6';
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cf3 Cc');
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cf3 C');
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cf3');
  });
});
