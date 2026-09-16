/**
 * Certified pool integrity — runs against the generated dataset.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import {
  CERTIFIED_DEFEND_DRAW_POSITIONS,
} from '../positions.ts';
import {
  DEFEND_DRAW_DIFFICULTIES,
  isEndgameConcept,
  isEndgameFamily,
} from '../taxonomy.ts';
import { normalizeFenKey } from '../builder/fenUtils.ts';
import { listCertifiedEndgames, getDefendDrawPosition } from '../EndgamePositionRepository.ts';
import { isAcceptableVerifiedDrawFlag } from '../certification.ts';
import { isTrivialDefendDrawPosition } from '../defensivePrecision.ts';
import { validateDefendDrawFen } from '../fenValidation.ts';

describe('generated pool integrity', () => {
  it('has unique IDs and FEN keys', () => {
    const ids = new Set<string>();
    const fens = new Set<string>();
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.match(p.id, /^DD-\d{3}$/, p.id);
      assert.equal(ids.has(p.id), false, `duplicate id ${p.id}`);
      ids.add(p.id);
      const key = normalizeFenKey(p.fen);
      assert.equal(fens.has(key), false, `duplicate fen ${p.id}`);
      fens.add(key);
    }
  });

  it('every row is certified with valid metadata', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 20);
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length < 117);
    for (const p of CERTIFIED_DEFEND_DRAW_POSITIONS) {
      assert.equal(p.verifiedDraw, true, p.id);
      assert.equal(
        isAcceptableVerifiedDrawFlag(p.verifiedDraw, p.verification),
        true,
        p.id,
      );
      assert.equal(p.verification.result, 'draw', p.id);
      assert.ok(DEFEND_DRAW_DIFFICULTIES.includes(p.difficulty), p.id);
      assert.equal(isEndgameFamily(p.family), true, p.id);
      assert.ok(p.concepts.length >= 1, p.id);
      for (const c of p.concepts) assert.equal(isEndgameConcept(c), true, p.id);
      const fen = validateDefendDrawFen(p.fen, p.defenderColor);
      assert.equal(fen.ok, true, `${p.id}: ${!fen.ok ? fen.reason : ''}`);
      assert.equal(isTrivialDefendDrawPosition(p), false, p.id);
      const g = new Chess(p.fen);
      assert.equal(g.isGameOver(), false, p.id);
    }
  });

  it('populated difficulty bands are selectable', () => {
    for (const diff of DEFEND_DRAW_DIFFICULTIES) {
      const band = CERTIFIED_DEFEND_DRAW_POSITIONS.filter((p) => p.difficulty === diff);
      if (band.length === 0) continue; // empty band OK after quality filter
      for (let i = 0; i < Math.min(8, band.length); i++) {
        const picked = getDefendDrawPosition(diff, [], () => i / 8);
        assert.equal(picked.difficulty, diff);
      }
    }
  });

  it('listCertifiedEndgames matches dataset length', () => {
    assert.equal(
      listCertifiedEndgames().length,
      CERTIFIED_DEFEND_DRAW_POSITIONS.length,
    );
  });

  it('supports quality-first pools without architectural caps', () => {
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length >= 20);
    assert.equal(Array.isArray(CERTIFIED_DEFEND_DRAW_POSITIONS), true);
    assert.ok(CERTIFIED_DEFEND_DRAW_POSITIONS.length < 1000);
  });
});
