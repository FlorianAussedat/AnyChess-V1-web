/**
 * FEN legality + theme material validators.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  validateFenLegality,
  validateThemeMaterial,
  LEGACY_THEORETICAL_IDS,
} from '../fenLegality.ts';
import { THEORETICAL_ENDGAME_POOL } from '../../data/pool.generated.ts';
import { THEME_IDS } from '../themes.ts';

describe('validateFenLegality', () => {
  it('accepts legal positions with neither king in check', () => {
    const r = validateFenLegality('8/8/8/4k3/8/8/8/4K2Q w - - 0 1');
    assert.equal(r.ok, true);
    assert.equal(r.whiteKingInCheck, false);
    assert.equal(r.blackKingInCheck, false);
  });

  it('rejects when the non-side-to-move king is in check', () => {
    // Queen attacks black king while white to move
    const r = validateFenLegality('8/8/8/8/8/5k2/8/6KQ w - - 0 1');
    assert.equal(r.ok, false);
    assert.equal(r.blackKingInCheck, true);
  });

  it('rejects adjacent kings', () => {
    const r = validateFenLegality('8/8/8/3k4/4K3/8/8/8 w - - 0 1');
    assert.equal(r.ok, false);
  });
});

describe('validateThemeMaterial', () => {
  it('validates Lucena KRPKR structure', () => {
    const r = validateThemeMaterial(
      'lucena',
      '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 4 1',
    );
    assert.equal(r.ok, true);
  });

  it('rejects Lucena without two rooks', () => {
    const r = validateThemeMaterial('lucena', '7k/8/8/8/8/8/1P6/4K2R w - - 0 1');
    assert.equal(r.ok, false);
  });

  it('validates Philidor KRPKR', () => {
    const r = validateThemeMaterial(
      'philidor',
      '4k3/R7/1r6/4PK2/8/8/8/8 w - - 0 1',
    );
    assert.equal(r.ok, true);
  });

  it('requires opposite-colored bishops', () => {
    const r = validateThemeMaterial(
      'two-bishops-mate',
      '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
    );
    assert.equal(r.ok, true);
  });
});

describe('canonical pool contract', () => {
  it('has exactly 10 active positions and 10 themes', () => {
    const active = THEORETICAL_ENDGAME_POOL.filter((p) => p.active !== false);
    assert.equal(active.length, 10);
    assert.equal(THEME_IDS.length, 10);
    assert.ok(!THEME_IDS.includes('three-pawns' as never));
  });

  it('has one position per theme', () => {
    for (const id of THEME_IDS) {
      const n = THEORETICAL_ENDGAME_POOL.filter(
        (p) => p.active !== false && p.themeId === id,
      ).length;
      assert.equal(n, 1, id);
    }
  });

  it('contains no legacy TE-NNN ids', () => {
    for (const p of THEORETICAL_ENDGAME_POOL) {
      assert.ok(!LEGACY_THEORETICAL_IDS.includes(p.id), p.id);
      assert.ok(p.id.startsWith('TE-CANON-'), p.id);
    }
  });

  it('passes legality for every active position', () => {
    for (const p of THEORETICAL_ENDGAME_POOL) {
      const r = validateFenLegality(p.initialFen);
      assert.equal(r.ok, true, `${p.id}: ${r.errors.join('; ')}`);
      const m = validateThemeMaterial(p.themeId, p.initialFen);
      assert.equal(m.ok, true, `${p.id}: ${m.errors.join('; ')}`);
    }
  });

  it('Lucena is WIN with two rooks; Philidor is DRAW for black', () => {
    const lucena = THEORETICAL_ENDGAME_POOL.find((p) => p.themeId === 'lucena')!;
    const philidor = THEORETICAL_ENDGAME_POOL.find((p) => p.themeId === 'philidor')!;
    assert.equal(lucena.objective, 'WIN');
    assert.equal(philidor.objective, 'DRAW');
    assert.equal(philidor.playerColor, 'black');
  });
});
