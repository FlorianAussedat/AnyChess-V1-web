/**
 * Official regulatory result messages.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { officialResultMessage } from '../officialResultMessages.ts';

describe('officialResultMessage', () => {
  it('stalemate draw message', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'white',
        officialDrawReason: 'stalemate',
      }),
      'Nulle obtenue par pat. Bien joué !',
    );
  });

  it('threefold repetition', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'black',
        officialDrawReason: 'threefold',
      }),
      'Nulle obtenue par répétition. Bien joué !',
    );
  });

  it('checkmate win for player', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'win-official-draw',
        playerColor: 'white',
        checkmateWinner: 'w',
      }),
      'Échec et mat. Partie gagnée !',
    );
  });

  it('checkmate loss for player', () => {
    assert.equal(
      officialResultMessage({
        outcome: 'loss',
        playerColor: 'white',
        checkmateWinner: 'b',
      }),
      'Échec et mat. Partie perdue.',
    );
  });
});
