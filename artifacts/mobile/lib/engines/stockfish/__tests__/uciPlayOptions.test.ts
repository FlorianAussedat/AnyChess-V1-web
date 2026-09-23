/**
 * G5: UCI play-strength mapping — Stockfish floor, no product-label rewrite.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampElo,
  FLOOR_STRENGTH_MULTIPV,
  FLOOR_STRENGTH_VARIETY_MARGIN_CP,
  MIN_UCI_ELO,
  setupOptionCommands,
  uciPlayOptionsForTargetElo,
} from '../uci.ts';
import {
  eloForBand,
  getStrengthBand,
  STOCKFISH_STRENGTH_BANDS,
} from '../../../difficulty/StockfishStrengthBands.ts';

describe('uciPlayOptionsForTargetElo', () => {
  it('clamps sub-1320 requests to the Stockfish floor + extra variety', () => {
    for (const elo of [700, 900, 1100, 1300]) {
      assert.deepEqual(uciPlayOptionsForTargetElo(elo), {
        elo: MIN_UCI_ELO,
        multiPv: FLOOR_STRENGTH_MULTIPV,
        varietyMarginCp: FLOOR_STRENGTH_VARIETY_MARGIN_CP,
      });
    }
  });

  it('passes through Elo at or above the floor without extra variety', () => {
    assert.deepEqual(uciPlayOptionsForTargetElo(1320), { elo: 1320 });
    assert.deepEqual(uciPlayOptionsForTargetElo(1500), { elo: 1500 });
    assert.deepEqual(uciPlayOptionsForTargetElo(1900), { elo: 1900 });
    assert.deepEqual(uciPlayOptionsForTargetElo(2400), { elo: 2400 });
  });

  it('keeps LimitStrength + clamped UCI_Elo in the handshake', () => {
    const cmds = setupOptionCommands(800, 8);
    assert.equal(cmds[0], 'setoption name UCI_LimitStrength value true');
    assert.equal(cmds[1], `setoption name UCI_Elo value ${MIN_UCI_ELO}`);
    assert.equal(cmds[2], 'setoption name MultiPV value 8');
    assert.equal(clampElo(800), MIN_UCI_ELO);
    assert.equal(clampElo(2100), 2100);
  });
});

describe('strength bands vs Stockfish floor', () => {
  it('maps the four weakest product bands onto the same UCI_Elo floor', () => {
    const noJitter = () => 0.5;
    const floorIds = ['lt800', '800-1000', '1000-1200', '1200-1400'];
    for (const id of floorIds) {
      const target = eloForBand(getStrengthBand(id), noJitter);
      assert.ok(target < MIN_UCI_ELO, `${id} target ${target} should be below floor`);
      assert.equal(uciPlayOptionsForTargetElo(target).elo, MIN_UCI_ELO);
    }
    const mid = eloForBand(getStrengthBand('1400-1600'), noJitter);
    assert.equal(mid, 1500);
    assert.deepEqual(uciPlayOptionsForTargetElo(mid), { elo: 1500 });
  });

  it('does not rename product labels', () => {
    assert.deepEqual(
      STOCKFISH_STRENGTH_BANDS.map((b) => b.label),
      [
        '<800',
        '800–1000',
        '1000–1200',
        '1200–1400',
        '1400–1600',
        '1600–1800',
        '1800–2000',
        '2000–2200',
        '>2200',
      ],
    );
  });
});
