/**
 * Theoretical official result messages.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canOfferTheoreticalFinishGame,
  theoreticalOfficialResultMessage,
} from '../officialResultMessages.ts';

describe('theoreticalOfficialResultMessage', () => {
  it('stalemate draw', () => {
    assert.equal(
      theoreticalOfficialResultMessage({
        outcome: 'success',
        playerColor: 'white',
        objective: 'DRAW',
        officialEndReason: 'stalemate',
      }),
      'Nulle obtenue par pat. Bien joué !',
    );
  });

  it('checkmate win', () => {
    assert.equal(
      theoreticalOfficialResultMessage({
        outcome: 'success',
        playerColor: 'white',
        objective: 'WIN',
        checkmateWinner: 'w',
      }),
      'Échec et mat. Partie gagnée !',
    );
  });

  it('checkmate loss', () => {
    assert.equal(
      theoreticalOfficialResultMessage({
        outcome: 'theoretical-loss',
        playerColor: 'white',
        objective: 'WIN',
        checkmateWinner: 'b',
      }),
      'Échec et mat. Partie perdue.',
    );
  });
});

describe('canOfferTheoreticalFinishGame', () => {
  it('offers when scored and still playable', () => {
    assert.equal(
      canOfferTheoreticalFinishGame({
        scoreLocked: true,
        gameOver: false,
        finishGameActive: false,
        phase: 'theoretical-loss',
      }),
      true,
    );
  });

  it('refuses when game over', () => {
    assert.equal(
      canOfferTheoreticalFinishGame({
        scoreLocked: true,
        gameOver: true,
        finishGameActive: false,
        phase: 'theoretical-loss',
      }),
      false,
    );
  });
});
