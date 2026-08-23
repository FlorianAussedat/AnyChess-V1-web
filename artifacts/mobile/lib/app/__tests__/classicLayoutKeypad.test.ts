/**
 * Classic Game layout contracts — single mode toggle, keypad below board, no Eff.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeBoardSize,
  fitBoardSizeToViewport,
  MIN_BOARD_SIZE,
} from '../../game/boardSize.ts';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('Classic single input-mode toggle', () => {
  it('renders exactly one mode toggle (no dual keypad/desktop toggles)', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /classic-input-mode-toggle/);
    assert.match(classic, /ClassicInputMode/);
    assert.match(classic, /inputMode/);
    assert.match(classic, /'classic' \| 'keypad'/);
    // Old dual-toggle contracts removed.
    assert.doesNotMatch(classic, /classic-keypad-visibility-toggle/);
    assert.doesNotMatch(classic, /classic-keyboard-mode-toggle/);
    assert.doesNotMatch(classic, /useSystemKeyboard/);
    assert.doesNotMatch(classic, /desktop-outline/);
    // ChessAnswerInput permanent field removed from Classic play layout.
    assert.doesNotMatch(classic, /ChessAnswerInput/);
  });

  it('toggle switches classic ↔ keypad and preserves draft intent', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /setChessInputMode/);
    assert.match(classic, /inputMode === 'classic' \? 'keypad' : 'classic'/);
  });
});

describe('Classic keypad placement and Eff removal', () => {
  it('places keypad below the board block and above talk controls', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    const boardIdx = classic.indexOf('testID="classic-board-block"');
    const keypadIdx = classic.indexOf('testID="classic-move-keypad"');
    const talkIdx = classic.indexOf('testID="classic-command-row"');
    // JSX usage (not the import line).
    const historyIdx = classic.indexOf('<GameMoveHistoryCard');
    assert.ok(boardIdx > 0 && keypadIdx > boardIdx, 'keypad after board');
    assert.ok(talkIdx > keypadIdx, 'talk after keypad in source order');
    assert.ok(historyIdx > talkIdx, 'history after talk');
  });

  it('does not render Eff / clear key on the keypad UI', () => {
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    assert.doesNotMatch(keypad, /action:\s*'clear'/);
    assert.doesNotMatch(keypad, /keypad\.clear/);
    assert.doesNotMatch(keypad, /label:\s*t\('keypad\.clear'\)/);
    assert.match(keypad, /action:\s*'backspace'/);
  });

  it('uses a fixed 6-column grid with a vertical backspace spanning rows 2–3', () => {
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    assert.match(keypad, /KEYPAD_COLUMNS/);
    assert.match(keypad, /keypadCellWidth/);
    assert.match(keypad, /keypadSpanWidth/);
    assert.match(keypad, /tallBackspaceHeight/);
    assert.match(keypad, /row-backspace-block/);
    assert.doesNotMatch(keypad, /id: '6'.*span:\s*2/s);
    assert.doesNotMatch(keypad, /flex:\s*key\.flex/);
  });
});

describe('Classic promotion picker wiring', () => {
  it('delegates promotion to the shared keypad + PromotionPicker', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    assert.match(classic, /fen=\{keypadFen\}/);
    assert.match(classic, /fenFromSanHistory/);
    assert.match(keypad, /PromotionPicker/);
    assert.match(keypad, /keypadBufferNeedsPromotion/);
    assert.match(keypad, /appendPromotionSuffix/);
  });
});

describe('fitBoardSizeToViewport', () => {
  it('caps wide board when chrome would overflow a phone viewport', () => {
    const wide = computeBoardSize(390, 'wide');
    const fitted = fitBoardSizeToViewport(wide, 844, 340 + 50 + 34);
    assert.ok(fitted <= wide);
    assert.ok(fitted >= MIN_BOARD_SIZE);
  });

  it('keeps width-based size when height budget is ample', () => {
    const wide = computeBoardSize(390, 'wide');
    const fitted = fitBoardSizeToViewport(wide, 1200, 200);
    assert.equal(fitted, wide);
  });
});
