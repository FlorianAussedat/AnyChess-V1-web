/**
 * Chess move keypad V2 — buffer helpers + Classic scope contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  appendMoveKeypadToken,
  backspaceMoveKeypad,
  buildMoveKeypadValue,
  canSubmitMoveKeypad,
  clearMoveKeypad,
  priorityMoveKeypadKeys,
  trimMoveKeypadBuffer,
} from '../chessMoveKeypad.ts';

const here = dirname(fileURLToPath(import.meta.url));
const classicPath = join(here, '../../../components/ClassicGameScreen.tsx');
const openingPath = join(here, '../../../components/OpeningGameScreen.tsx');
const puzzlePath = join(here, '../../../components/puzzles/PuzzlePlayingPhase.tsx');

describe('chess move keypad construction', () => {
  it('builds e4, Cf3, Cxf7+, castling', () => {
    assert.equal(buildMoveKeypadValue(['e', '4']), 'e4');
    assert.equal(buildMoveKeypadValue(['C', 'f', '3']), 'Cf3');
    assert.equal(buildMoveKeypadValue(['C', 'x', 'f', '7', '+']), 'Cxf7+');
    assert.equal(appendMoveKeypadToken('', 'O-O'), 'O-O');
    assert.equal(appendMoveKeypadToken('', 'O-O-O'), 'O-O-O');
    assert.equal(appendMoveKeypadToken('C', 'O-O'), 'O-O');
  });

  it('trims spaces and gates empty submit', () => {
    assert.equal(trimMoveKeypadBuffer('  Cf3  '), 'Cf3');
    assert.equal(canSubmitMoveKeypad(''), false);
    assert.equal(canSubmitMoveKeypad('   '), false);
    assert.equal(canSubmitMoveKeypad('e4'), true);
  });
});

describe('chess move keypad backspace / clear', () => {
  it('removes last character logically through Cxf7+', () => {
    let v = 'Cxf7+';
    v = backspaceMoveKeypad(v);
    assert.equal(v, 'Cxf7');
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
    assert.equal(appendMoveKeypadToken(clearMoveKeypad(), 'C'), 'C');
  });
});

describe('chess move keypad contextual priority', () => {
  it('highlights plausible keys without implying hard locks', () => {
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
  it('wires keypad + shared submit + system keyboard fallback in Classic only', () => {
    const classic = readFileSync(classicPath, 'utf8');
    assert.match(classic, /ChessMoveKeypad/);
    assert.match(classic, /classic-move-keypad/);
    assert.match(classic, /classic-keyboard-mode-toggle/);
    assert.match(classic, /useSystemKeyboard/);
    assert.match(classic, /commitTypedMove/);
    assert.match(classic, /submitDraftFromKeypad/);
    assert.match(classic, /Compose ou dicte le coup/);
    assert.match(classic, /showSoftInputOnFocus:\s*useSystemKeyboard/);
    assert.match(classic, /GameMicButton/);
    assert.match(classic, /classic-mic/);
    // Voice still goes through applyUserMove pipeline directly.
    assert.match(classic, /onTranscript:\s*\(text\)\s*=>\s*applyRef\.current\(text\)/);

    const opening = readFileSync(openingPath, 'utf8');
    assert.doesNotMatch(opening, /ChessMoveKeypad/);

    const puzzle = readFileSync(puzzlePath, 'utf8');
    assert.doesNotMatch(puzzle, /ChessMoveKeypad/);
  });

  it('keypad Valider and arrow share commitTypedMove path', () => {
    const classic = readFileSync(classicPath, 'utf8');
    assert.match(classic, /onSubmit=\{commitTypedMove\}/);
    assert.match(classic, /onSubmit=\{submitDraftFromKeypad\}/);
    assert.match(classic, /commitTypedMove\(draftMove\)/);
  });
});
