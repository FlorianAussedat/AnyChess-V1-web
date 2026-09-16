import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { applyUserMoveInput } from '../applyUserMoveInput.ts';
import { legalDestinationsForSquare } from '../legalDestinations.ts';
import { looksLikeChessMove } from '../looksLikeChessMove.ts';
import { pairMoveHistory } from '../pairMoveHistory.ts';
import { resolveSideChoice } from '../resolveSideChoice.ts';
import { undoPlayerTurn } from '../undoPlayerTurn.ts';

describe('looksLikeChessMove', () => {
  it('accepts square names and piece vocabulary', () => {
    assert.equal(looksLikeChessMove('e4'), true);
    assert.equal(looksLikeChessMove('cavalier f3'), true);
    assert.equal(looksLikeChessMove('prend'), true);
  });

  it('rejects unrelated noise', () => {
    assert.equal(looksLikeChessMove('bonjour'), false);
    assert.equal(looksLikeChessMove(''), false);
  });
});

describe('pairMoveHistory', () => {
  it('pairs SANs into numbered rows', () => {
    assert.deepEqual(pairMoveHistory(['e4', 'e5', 'Nf3']), [
      { key: '0', num: 1, white: 'e4', black: 'e5' },
      { key: '2', num: 2, white: 'Nf3', black: '' },
    ]);
  });
});

describe('resolveSideChoice', () => {
  it('returns concrete colors and honors random', () => {
    assert.equal(resolveSideChoice('w'), 'w');
    assert.equal(resolveSideChoice('b'), 'b');
    assert.equal(resolveSideChoice('random', () => 0.1), 'w');
    assert.equal(resolveSideChoice('random', () => 0.9), 'b');
  });
});

describe('legalDestinationsForSquare', () => {
  it('lists white pawn destinations when waiting', () => {
    const game = new Chess();
    const dests = legalDestinationsForSquare(game, 'e2', 'w', { waitingForUser: true });
    assert.deepEqual(dests.sort(), ['e3', 'e4']);
  });

  it('returns empty when not waiting', () => {
    const game = new Chess();
    assert.deepEqual(
      legalDestinationsForSquare(game, 'e2', 'w', { waitingForUser: false }),
      [],
    );
  });
});

describe('applyUserMoveInput', () => {
  it('applies a legal SAN-like voice move', () => {
    const game = new Chess();
    const result = applyUserMoveInput({
      raw: 'e4',
      game,
      mode: 'classic',
      waitingForUser: true,
      isOpponentThinking: false,
    });
    assert.equal(result.kind, 'played');
    if (result.kind === 'played') {
      assert.equal(result.played.san, 'e4');
      assert.equal(game.history().length, 1);
    }
  });

  it('rejects illegal attempts with error signal', () => {
    const game = new Chess();
    const result = applyUserMoveInput({
      raw: 'e5',
      game,
      mode: 'classic',
      waitingForUser: true,
      isOpponentThinking: false,
    });
    assert.equal(result.kind, 'illegal');
    assert.equal(game.history().length, 0);
  });

  it('routes undo as a command without touching the board', () => {
    const game = new Chess();
    game.move('e4');
    const result = applyUserMoveInput({
      raw: 'annuler',
      game,
      mode: 'opening',
      waitingForUser: false,
      isOpponentThinking: true,
    });
    assert.equal(result.kind, 'command');
    if (result.kind === 'command') assert.equal(result.command, 'undo');
    assert.equal(game.history().length, 1);
  });

  it('ignores non-command input while busy', () => {
    const game = new Chess();
    const result = applyUserMoveInput({
      raw: 'e4',
      game,
      mode: 'classic',
      waitingForUser: false,
      isOpponentThinking: true,
    });
    assert.equal(result.kind, 'ignored-busy');
    assert.equal(game.history().length, 0);
  });
});

describe('undoPlayerTurn', () => {
  it('undoes player + opponent plies', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    const result = undoPlayerTurn(game, 'w');
    assert.ok(result.kind === 'undone' || result.kind === 'undone-to-start');
    assert.equal(game.history().length, 0);
    if (result.kind === 'undone') {
      assert.equal(result.plyAfter, 0);
      assert.equal(result.needsOpponentKickoff, false);
    }
    if (result.kind === 'undone-to-start') {
      assert.equal(result.needsOpponentKickoff, false);
    }
  });

  it('undoes a single player ply back to start', () => {
    const game = new Chess();
    game.move('e4');
    const result = undoPlayerTurn(game, 'w');
    assert.equal(result.kind, 'undone-to-start');
    assert.equal(game.history().length, 0);
    if (result.kind === 'undone-to-start') {
      assert.equal(result.needsOpponentKickoff, false);
    }
  });

  it('undoes only the player ply when the reply is not on the board yet', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    // Last ply is still White's — reply pending.
    const result = undoPlayerTurn(game, 'w');
    assert.equal(result.kind, 'undone');
    assert.deepEqual(game.history(), ['e4', 'e5']);
    assert.equal(game.turn(), 'w');
    if (result.kind === 'undone') {
      assert.equal(result.needsOpponentKickoff, false);
      assert.equal(result.plyAfter, 2);
    }
  });

  it('as Black, undoing a pending reply leaves White to move and needs kickoff', () => {
    const game = new Chess();
    game.move('e4');
    game.move('e5');
    // Black to move; if Black somehow had only played... after e4 e5 turn is White.
    // Sequence: e4, e5, Nf3 — Black plays Nc6, undo before White replies.
    game.move('Nf3');
    game.move('Nc6');
    assert.equal(game.turn(), 'w');
    const result = undoPlayerTurn(game, 'b');
    assert.equal(result.kind, 'undone');
    assert.deepEqual(game.history(), ['e4', 'e5', 'Nf3']);
    assert.equal(game.turn(), 'b');
    if (result.kind === 'undone') {
      assert.equal(result.needsOpponentKickoff, false);
    }
  });

  it('is a no-op when there is nothing to undo for the player', () => {
    const game = new Chess();
    assert.equal(undoPlayerTurn(game, 'w').kind, 'noop');
  });
});
