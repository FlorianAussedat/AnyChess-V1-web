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

  it('Opening uses scaffold + classic command row layout', () => {
    const opening = read('components/OpeningGameScreen.tsx');
    assert.match(opening, /ChessScreenScaffold/);
    assert.match(opening, /ChessBoardSection/);
    assert.match(opening, /ChessKeyboardToggle/);
    assert.match(opening, /opening-command-row/);
    assert.match(opening, /opening-input-mode-toggle/);
    assert.match(opening, /fitBoardSizeToViewport/);
    assert.match(opening, /OpeningVariationLabel/);
    assert.match(opening, /opening-status-row/);
    assert.doesNotMatch(opening, /ChessMoveInput/);
  });

  it('theoretical and defend-draw reuse Classic command row + notation', () => {
    const theoretical = read('app/puzzles/finales-theoriques-play.tsx');
    const defend = read('app/puzzles/defends-nulle-play.tsx');
    for (const src of [theoretical, defend]) {
      assert.match(src, /ChessScreenScaffold/);
      assert.match(src, /ChessBoardSection/);
      assert.match(src, /ClassicCommandInputChrome/);
      assert.match(src, /GameMoveHistoryCard/);
      assert.match(src, /GameStatusCard/);
      assert.match(src, /fitBoardSizeToViewport/);
      assert.doesNotMatch(src, /ChessMoveInput/);
    }
    assert.match(theoretical, /theoretical-command-row/);
    assert.match(theoretical, /theoretical-input-mode-toggle/);
    assert.match(defend, /endgame-command-row/);
    assert.match(defend, /endgame-input-mode-toggle/);
  });
});

describe('ChessBoard square hits', () => {
  it('puts a full-cell Pressable above pieces so SVG cannot steal web clicks', () => {
    const board = read('components/ChessBoard.tsx');
    assert.match(board, /testID=\{`board-square-\$\{sqName\}`\}/);
    assert.match(board, /pointerEvents="none"/);
    assert.match(board, /position: 'relative'/);
    assert.match(board, /StyleSheet\.absoluteFill/);
    assert.match(board, /displayCellToSquare|squareFromBoardIndices/);
    assert.doesNotMatch(board, /PanResponder|onPan|drag/);
    const piece = read('components/PieceSvg.tsx');
    assert.match(piece, /pointerEvents="none"/);
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

describe('keypad vertical backspace layout', () => {
  it('backspace spans rows 2–3 and rank 6 is single-width', () => {
    const keypad = read('components/game/ChessMoveKeypad.tsx');
    assert.match(keypad, /row-backspace-block/);
    assert.match(keypad, /tallBackspaceHeight/);
    assert.match(keypad, /id:\s*'6',\s*label:\s*'6',\s*token:\s*'6'/);
    assert.doesNotMatch(keypad, /token:\s*'6',\s*span:\s*2/);
    assert.match(keypad, /span:\s*3/); // castling
  });
});
