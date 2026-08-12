/**
 * Shared chess screen architecture contracts.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '../../..');

function read(rel: string): string {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('shared chess screen scaffold', () => {
  it('exposes ChessScreenScaffold / ChessBoardSection / ChessKeyboardToggle', () => {
    assert.match(read('components/game/ChessScreenScaffold.tsx'), /export function ChessScreenScaffold/);
    assert.match(read('components/game/ChessBoardSection.tsx'), /export function ChessBoardSection/);
    assert.match(read('components/game/ChessKeyboardToggle.tsx'), /export function ChessKeyboardToggle/);
  });

  it('Classic uses scaffold + shared keyboard toggle', () => {
    const classic = read('components/ClassicGameScreen.tsx');
    assert.match(classic, /ChessScreenScaffold/);
    assert.match(classic, /ChessBoardSection/);
    assert.match(classic, /ChessKeyboardToggle/);
    assert.match(classic, /classic-input-mode-toggle/);
    assert.doesNotMatch(classic, /from '@expo\/vector-icons'/);
  });

  it('Opening uses scaffold + board section', () => {
    const opening = read('components/OpeningGameScreen.tsx');
    assert.match(opening, /ChessScreenScaffold/);
    assert.match(opening, /ChessBoardSection/);
    assert.match(opening, /ChessMoveInput/);
  });
});

describe('ChessMoveInput keypad visibility toggle', () => {
  it('embeds ChessKeyboardToggle and can hide the keypad', () => {
    const input = read('components/game/ChessMoveInput.tsx');
    assert.match(input, /ChessKeyboardToggle/);
    assert.match(input, /showKeyboardToggle/);
    assert.match(input, /keypadVisible/);
    assert.match(input, /showSoftInputOnFocus=\{false\}/);
    assert.match(input, /keypad-toggle/);
  });
});

describe('keypad backspace span-2 layout', () => {
  it('backspace spans 2 columns and rank 6 is single-width', () => {
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    assert.match(keypad, /id:\s*'backspace'[\s\S]*?span:\s*2/);
    assert.match(keypad, /id:\s*'6',\s*label:\s*'6',\s*token:\s*'6'/);
    assert.doesNotMatch(keypad, /token:\s*'6',\s*span:\s*2/);
    assert.match(keypad, /span:\s*3/); // castling
  });
});
