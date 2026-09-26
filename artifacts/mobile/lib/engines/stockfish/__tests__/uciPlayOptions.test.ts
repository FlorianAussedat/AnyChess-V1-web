/**
 * G5: UCI play-strength mapping — Stockfish floor, no product-label rewrite.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampElo,
  FLOOR_STRENGTH_MULTIPV,
  FLOOR_STRENGTH_VARIETY_MARGIN_CP,
  fullStrengthAnalysisOptionCommands,
  gameGoCommand,
  humanEloSearchLimit,
  MIN_UCI_ELO,
  parseUciEloBounds,
  resetUciEloBounds,
  setupOptionCommands,
  stockfishSkillLevelForElo,
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
        moveTimeMs: 600,
      });
    }
  });

  it('passes through Elo at or above the floor without extra variety', () => {
    for (const elo of [1320, 1500, 1900, 2400]) {
      const profile = uciPlayOptionsForTargetElo(elo);
      assert.equal(profile.elo, elo);
      assert.equal(profile.multiPv, 1);
      assert.equal(profile.varietyMarginCp, 0);
    }
  });

  it('maps 2000 to UCI_Elo only — no Skill Level and no tiny depth', () => {
    const profile = uciPlayOptionsForTargetElo(2000);
    assert.equal(profile.elo, 2000);
    assert.equal(profile.multiPv, 1);
    assert.equal(profile.varietyMarginCp, 0);
    const cmds = setupOptionCommands(profile.elo, profile.multiPv);
    assert.deepEqual(cmds, [
      'setoption name UCI_LimitStrength value true',
      'setoption name UCI_Elo value 2000',
      'setoption name MultiPV value 1',
    ]);
    assert.equal(
      cmds.some((cmd) => cmd.includes('Skill Level')),
      false,
    );
    const limit = humanEloSearchLimit(2000);
    const skill = stockfishSkillLevelForElo(2000);
    assert.equal(limit.pickDepth, 1 + Math.floor(skill));
    assert.equal(limit.depth, limit.pickDepth + 2);
    assert.ok(limit.depth >= 7, `depth ${limit.depth} is below the skill pick`);
    assert.ok(limit.movetimeMs >= 500 && limit.movetimeMs <= 900);
    const go = gameGoCommand(profile);
    assert.equal(go, `go depth ${limit.depth} movetime ${limit.movetimeMs}`);
    assert.doesNotMatch(go, /\bnodes\b/);
    assert.notEqual(go, 'go movetime 50');
  });

  it('reads UCI_Elo bounds from the engine option line', () => {
    const bounds = parseUciEloBounds(
      'option name UCI_Elo type spin default 1320 min 1320 max 3190',
    );
    assert.deepEqual(bounds, { defaultValue: 1320, min: 1320, max: 3190 });
    assert.equal(parseUciEloBounds('option name Hash type spin default 16 min 1 max 33554432'), null);
    resetUciEloBounds();
  });

  it('analysis profile clears LimitStrength and does not keep a game Elo', () => {
    const cmds = fullStrengthAnalysisOptionCommands(1);
    assert.equal(cmds[0], 'setoption name UCI_LimitStrength value false');
    assert.equal(
      cmds.some((cmd) => cmd.includes('UCI_Elo') || cmd.includes('Skill Level')),
      false,
    );
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
    const midProfile = uciPlayOptionsForTargetElo(mid);
    assert.equal(midProfile.elo, 1500);
    assert.equal(midProfile.multiPv, 1);
    assert.equal(midProfile.varietyMarginCp, 0);
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
