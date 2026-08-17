/**
 * Builder unit tests — deterministic helpers, no live Syzygy.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createSeededRng } from '../builder/seededRng.ts';
import { generateAllCandidates } from '../builder/generators.ts';
import { normalizeFenKey } from '../builder/fenUtils.ts';
import { suggestDefendDrawDifficulty } from '../builder/suggestDifficulty.ts';
import { inferEndgameFamily } from '../builder/inferTaxonomy.ts';

describe('seeded candidate generation', () => {
  it('produces the same candidate count with the same seed', () => {
    const a = generateAllCandidates({ seed: 42, kpvkLimit: 20, kvkpLimit: 10, rookLimit: 10, mixedLimit: 10 });
    const b = generateAllCandidates({ seed: 42, kpvkLimit: 20, kvkpLimit: 10, rookLimit: 10, mixedLimit: 10 });
    assert.equal(a.length, b.length);
    assert.deepEqual(
      a.map((c) => normalizeFenKey(c.fen)),
      b.map((c) => normalizeFenKey(c.fen)),
    );
  });

  it('deduplicates FEN keys inside one generation pass', () => {
    const list = generateAllCandidates({ seed: 7, kpvkLimit: 30, kvkpLimit: 20, rookLimit: 15, mixedLimit: 15 });
    const keys = list.map((c) => normalizeFenKey(c.fen));
    assert.equal(keys.length, new Set(keys).size);
  });
});

describe('suggestDefendDrawDifficulty', () => {
  it('keeps K+P vs K with many drawing moves in beginner band', () => {
    const fen = '8/8/3k4/3P4/3K4/8/8/8 b - - 0 1';
    const band = suggestDefendDrawDifficulty({
      fen,
      family: 'pawn',
      metrics: {
        legalMoves: 3,
        drawingMoves: 3,
        losingMoves: 0,
        drawingRatio: 1,
        criticalMoves: 0,
        uniqueMoveMoments: 0,
      },
    });
    assert.equal(band, 'debutant');
  });

  it('biases Q vs R toward grandmaster', () => {
    const fen = '8/8/8/4k3/8/4r3/4K3/4Q3 w - - 0 1';
    const band = suggestDefendDrawDifficulty({
      fen,
      family: inferEndgameFamily(fen),
      metrics: {
        legalMoves: 12,
        drawingMoves: 2,
        losingMoves: 10,
        drawingRatio: 0.16,
        criticalMoves: 2,
        uniqueMoveMoments: 1,
      },
    });
    assert.ok(band === 'grandMaitre' || band === 'expert');
  });
});

describe('rng', () => {
  it('createSeededRng is reproducible', () => {
    const a = createSeededRng(99);
    const b = createSeededRng(99);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    assert.deepEqual(seqA, seqB);
  });
});
