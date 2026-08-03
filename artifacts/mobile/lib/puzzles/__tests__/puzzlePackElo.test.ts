/**
 * Validates the embedded multi-Elo puzzle pack:
 * - occupancy per Elo band
 * - sample FEN legality + solution-move legality in every band
 * - repository query stays inside requested rating bounds
 * - selectPuzzle never leaves the requested Elo range
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { puzzleRepository } from '../PuzzleRepository.ts';
import { selectPuzzle } from '../PuzzleSelector.ts';
import {
  PUZZLE_RATING_BANDS,
  puzzleBandForRating,
} from '../puzzleBands.ts';
import type { LocalPuzzle } from '../types.ts';

const SAMPLE_PER_BAND = 25;

function assertLegalLine(puzzle: LocalPuzzle): void {
  const game = new Chess(puzzle.fen);
  assert.ok(puzzle.moves.length >= 2, `${puzzle.id}: needs setup + user move`);
  for (const uci of puzzle.moves) {
    assert.ok(uci.length >= 4, `${puzzle.id}: bad UCI ${uci}`);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.slice(4) || undefined;
    const played = game.move({ from, to, promotion });
    assert.ok(played, `${puzzle.id}: illegal move ${uci} from ${game.fen()}`);
  }
}

describe('embedded puzzle pack — Elo coverage', () => {
  const counts = puzzleRepository.bandCounts();
  const manifest = puzzleRepository.getManifest();

  it('imports thousands of puzzles across every Elo band', () => {
    assert.ok(puzzleRepository.count() >= 4000, `count=${puzzleRepository.count()}`);
    assert.equal(manifest.license, 'CC0');
    assert.ok(manifest.sourceUrl?.includes('lichess'));

    for (const band of PUZZLE_RATING_BANDS) {
      if (band.id === 'all') continue;
      const n = counts[band.id] ?? 0;
      assert.ok(
        n >= 400,
        `band ${band.id} expected ≥400 puzzles, got ${n}`,
      );
    }
  });

  it('has unique puzzle ids and no duplicate fen+moves identities', () => {
    const all = puzzleRepository.getAll();
    const ids = new Set<string>();
    const identities = new Set<string>();
    for (const p of all) {
      assert.ok(!ids.has(p.id), `duplicate id ${p.id}`);
      ids.add(p.id);
      const key = `${p.fen}|${p.moves.join(' ')}`;
      assert.ok(!identities.has(key), `duplicate identity ${p.id}`);
      identities.add(key);
    }
    assert.equal(ids.size, all.length);
  });

  it('every puzzle rating maps into exactly one concrete Elo band', () => {
    for (const p of puzzleRepository.getAll()) {
      const band = puzzleBandForRating(p.rating);
      assert.ok(band, `rating ${p.rating} for ${p.id} has no band`);
      assert.ok(
        p.rating >= band!.ratingMin && p.rating <= band!.ratingMax,
      );
    }
  });
});

describe('embedded puzzle pack — legality sample per Elo band', () => {
  for (const band of PUZZLE_RATING_BANDS) {
    if (band.id === 'all') continue;

    it(`validates FEN + solution sample for ${band.id}`, () => {
      const list = puzzleRepository.getByBandId(band.id);
      assert.ok(list.length > 0, `empty band ${band.id}`);
      const step = Math.max(1, Math.floor(list.length / SAMPLE_PER_BAND));
      let checked = 0;
      for (let i = 0; i < list.length && checked < SAMPLE_PER_BAND; i += step) {
        const p = list[i]!;
        assert.ok(
          p.rating >= band.ratingMin && p.rating <= band.ratingMax,
          `${p.id} rating ${p.rating} outside ${band.id}`,
        );
        assertLegalLine(p);
        // Side to move is encoded in FEN; setup move must be legal for that side.
        const side = p.fen.split(' ')[1];
        assert.ok(side === 'w' || side === 'b', `${p.id}: bad side ${side}`);
        checked += 1;
      }
      assert.equal(checked, Math.min(SAMPLE_PER_BAND, list.length));
    });
  }
});

describe('repository query + selectPuzzle Elo bounds', () => {
  it('query never returns puzzles outside the requested Elo range', () => {
    for (const band of PUZZLE_RATING_BANDS) {
      if (band.id === 'all') continue;
      const hit = puzzleRepository.query({
        ratingMin: band.ratingMin,
        ratingMax: band.ratingMax,
      });
      assert.ok(hit.length > 0, band.id);
      for (const p of hit) {
        assert.ok(
          p.rating >= band.ratingMin && p.rating <= band.ratingMax,
          `${p.id} ${p.rating} outside ${band.id}`,
        );
      }
    }
  });

  it('selectPuzzle stays inside the requested Elo range across seeds', () => {
    const band = PUZZLE_RATING_BANDS.find((b) => b.id === '1400-1599')!;
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const chosen = selectPuzzle({
        repository: puzzleRepository,
        filters: { ratingMin: band.ratingMin, ratingMax: band.ratingMax },
        seed,
      });
      assert.ok(chosen);
      assert.ok(
        chosen!.rating >= band.ratingMin && chosen!.rating <= band.ratingMax,
      );
      seen.add(chosen!.id);
    }
    assert.ok(seen.size > 8, `expected randomized picks, got ${seen.size}`);
  });

  it('selectPuzzle prefers excludeIds when alternatives remain', () => {
    const band = PUZZLE_RATING_BANDS.find((b) => b.id === '1000-1199')!;
    const pool = puzzleRepository.getByBandId(band.id);
    assert.ok(pool.length > 10);
    const excludeIds = pool.slice(0, pool.length - 3).map((p) => p.id);
    const allowed = new Set(pool.slice(pool.length - 3).map((p) => p.id));
    for (let seed = 0; seed < 20; seed++) {
      const chosen = selectPuzzle({
        repository: puzzleRepository,
        filters: { ratingMin: band.ratingMin, ratingMax: band.ratingMax },
        excludeIds,
        seed,
      });
      assert.ok(chosen);
      assert.ok(allowed.has(chosen!.id), `picked excluded ${chosen!.id}`);
    }
  });
});
