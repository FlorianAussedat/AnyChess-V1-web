import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LocalPuzzle } from '../types.ts';
import {
  filterPuzzles,
  selectPuzzle,
  countPiecesAfterSetup,
  type PuzzleSource,
} from '../PuzzleSelector.ts';
import {
  PUZZLE_RATING_BANDS,
  PIECE_COUNT_BANDS,
  getPuzzleRatingBand,
  puzzleBandForRating,
} from '../puzzleBands.ts';

/** 3 pieces after setup. rating 700 → 600-799. */
const THREE_PIECE: LocalPuzzle = {
  id: 'three',
  fen: '8/8/8/8/4P3/4k3/8/4K3 w - - 0 1',
  moves: ['e4e5', 'e3e4'],
  rating: 700,
  popularity: 90,
  themes: ['endgame'],
};

/** 6 pieces after setup. rating 950 → 800-999. */
const SIX_PIECE: LocalPuzzle = {
  id: 'six',
  fen: '8/8/2p5/8/1P1P4/3k4/8/2R1K3 w - - 0 1',
  moves: ['d4d5', 'd3e4'],
  rating: 950,
  popularity: 88,
  themes: ['endgame'],
};

/** 14 pieces after setup. rating 1700 → 1600-1799. */
const FOURTEEN: LocalPuzzle = {
  id: 'fourteen',
  fen: '4k3/ppp2ppp/8/8/8/8/PPP2PPP/4K3 w - - 0 1',
  moves: ['e1e2', 'e8e7'],
  rating: 1700,
  popularity: 91,
  themes: ['endgame'],
};

/** 3 pieces, high rating → 2200+. */
const HIGH_RATED: LocalPuzzle = {
  id: 'high',
  fen: '8/8/8/8/4P3/4k3/8/4K3 w - - 0 1',
  moves: ['e4e5', 'e3e4'],
  rating: 2300,
  popularity: 80,
  themes: ['mate'],
};

const PACK: LocalPuzzle[] = [THREE_PIECE, SIX_PIECE, FOURTEEN, HIGH_RATED];

function mockRepo(puzzles: LocalPuzzle[]): PuzzleSource {
  return { getAll: () => puzzles };
}

describe('countPiecesAfterSetup', () => {
  it('counts pieces after the setup UCI', () => {
    assert.equal(countPiecesAfterSetup(THREE_PIECE.fen, THREE_PIECE.moves[0]), 3);
    assert.equal(countPiecesAfterSetup(SIX_PIECE.fen, SIX_PIECE.moves[0]), 6);
    assert.equal(countPiecesAfterSetup(FOURTEEN.fen, FOURTEEN.moves[0]), 14);
  });
});

describe('rating band filters via PuzzleSelector', () => {
  it('filters by PUZZLE_RATING_BANDS Elo ranges', () => {
    const low = PUZZLE_RATING_BANDS.find((b) => b.id === '600-799')!;
    const hit = filterPuzzles(PACK, {
      ratingMin: low.ratingMin,
      ratingMax: low.ratingMax,
    });
    assert.deepEqual(
      hit.map((p) => p.id),
      ['three'],
    );

    const band800 = PUZZLE_RATING_BANDS.find((b) => b.id === '800-999')!;
    assert.deepEqual(
      filterPuzzles(PACK, {
        ratingMin: band800.ratingMin,
        ratingMax: band800.ratingMax,
      }).map((p) => p.id),
      ['six'],
    );

    const mid = PUZZLE_RATING_BANDS.find((b) => b.id === '1600-1799')!;
    assert.deepEqual(
      filterPuzzles(PACK, {
        ratingMin: mid.ratingMin,
        ratingMax: mid.ratingMax,
      }).map((p) => p.id),
      ['fourteen'],
    );

    const top = PUZZLE_RATING_BANDS.find((b) => b.id === '2200+')!;
    assert.deepEqual(
      filterPuzzles(PACK, {
        ratingMin: top.ratingMin,
        ratingMax: top.ratingMax,
      }).map((p) => p.id),
      ['high'],
    );

    const all = PUZZLE_RATING_BANDS.find((b) => b.id === 'all')!;
    assert.equal(
      filterPuzzles(PACK, { ratingMin: all.ratingMin, ratingMax: all.ratingMax }).length,
      PACK.length,
    );
  });

  it('getPuzzleRatingBand / puzzleBandForRating helpers', () => {
    assert.equal(getPuzzleRatingBand('1200-1399').label, '1200–1399');
    assert.equal(getPuzzleRatingBand('missing').id, 'all');
    assert.equal(puzzleBandForRating(650)?.id, '600-799');
    assert.equal(puzzleBandForRating(2200)?.id, '2200+');
    assert.equal(puzzleBandForRating(100)?.id, undefined);
  });
});

describe('piece-count band filters via PuzzleSelector', () => {
  it('filters by PIECE_COUNT_BANDS min/max', () => {
    const le5 = PIECE_COUNT_BANDS.find((b) => b.id === 'le5')!;
    const hit = filterPuzzles(PACK, {
      ratingMin: 0,
      ratingMax: 4000,
      pieceCountMin: le5.min,
      pieceCountMax: le5.max,
    });
    assert.deepEqual(
      hit.map((p) => p.id).sort(),
      ['high', 'three'],
    );

    const sixSeven = PIECE_COUNT_BANDS.find((b) => b.id === '6-7')!;
    assert.deepEqual(
      filterPuzzles(PACK, {
        ratingMin: 0,
        ratingMax: 4000,
        pieceCountMin: sixSeven.min,
        pieceCountMax: sixSeven.max,
      }).map((p) => p.id),
      ['six'],
    );

    const thirteen = PIECE_COUNT_BANDS.find((b) => b.id === '13-15')!;
    assert.deepEqual(
      filterPuzzles(PACK, {
        ratingMin: 0,
        ratingMax: 4000,
        pieceCountMin: thirteen.min,
        pieceCountMax: thirteen.max,
      }).map((p) => p.id),
      ['fourteen'],
    );
  });
});

describe('combined rating + piece-count filters', () => {
  it('intersects both filters for blind-mode style selection', () => {
    const rating = PUZZLE_RATING_BANDS.find((b) => b.id === '800-999')!;
    const pieces = PIECE_COUNT_BANDS.find((b) => b.id === '6-7')!;
    const hit = filterPuzzles(PACK, {
      ratingMin: rating.ratingMin,
      ratingMax: rating.ratingMax,
      pieceCountMin: pieces.min,
      pieceCountMax: pieces.max,
    });
    assert.deepEqual(
      hit.map((p) => p.id),
      ['six'],
    );

    const empty = filterPuzzles(PACK, {
      ratingMin: rating.ratingMin,
      ratingMax: rating.ratingMax,
      pieceCountMin: 13,
      pieceCountMax: 15,
    });
    assert.equal(empty.length, 0);
  });

  it('selectPuzzle returns null when nothing matches', () => {
    const chosen = selectPuzzle({
      repository: mockRepo(PACK),
      filters: { ratingMin: 3000, ratingMax: 3100 },
      seed: 1,
    });
    assert.equal(chosen, null);
  });

  it('selectPuzzle respects combined filters and seed', () => {
    const chosen = selectPuzzle({
      repository: mockRepo(PACK),
      filters: {
        ratingMin: 600,
        ratingMax: 799,
        pieceCountMin: null,
        pieceCountMax: 5,
      },
      seed: 42,
    });
    assert.ok(chosen);
    assert.equal(chosen!.id, 'three');
  });
});

describe('Elo filtering + random selection', () => {
  const many: LocalPuzzle[] = [];
  for (let i = 0; i < 40; i++) {
    many.push({
      id: `r${i}`,
      fen: THREE_PIECE.fen,
      moves: THREE_PIECE.moves,
      rating: 600 + (i % 10) * 20, // 600–780 → 600-799 only
      popularity: 80,
      themes: ['fork'],
    });
  }
  for (let i = 0; i < 40; i++) {
    many.push({
      id: `h${i}`,
      fen: HIGH_RATED.fen,
      moves: HIGH_RATED.moves,
      rating: 2200 + (i % 20) * 10,
      popularity: 80,
      themes: ['mate'],
    });
  }

  it('never selects outside the requested Elo range', () => {
    const band = PUZZLE_RATING_BANDS.find((b) => b.id === '600-799')!;
    for (let seed = 0; seed < 30; seed++) {
      const chosen = selectPuzzle({
        repository: mockRepo(many),
        filters: { ratingMin: band.ratingMin, ratingMax: band.ratingMax },
        seed,
      });
      assert.ok(chosen);
      assert.ok(chosen!.rating >= band.ratingMin && chosen!.rating <= band.ratingMax);
      assert.ok(chosen!.id.startsWith('r'));
    }
  });

  it('randomizes within the Elo range across seeds', () => {
    const band = PUZZLE_RATING_BANDS.find((b) => b.id === '2200+')!;
    const ids = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const chosen = selectPuzzle({
        repository: mockRepo(many),
        filters: { ratingMin: band.ratingMin, ratingMax: band.ratingMax },
        seed,
      });
      assert.ok(chosen);
      ids.add(chosen!.id);
    }
    assert.ok(ids.size > 5, `expected varied picks, got ${ids.size}`);
  });

  it('avoids recently played ids when alternatives remain', () => {
    const band = PUZZLE_RATING_BANDS.find((b) => b.id === '600-799')!;
    const pool = many.filter(
      (p) => p.rating >= band.ratingMin && p.rating <= band.ratingMax,
    );
    const excludeIds = pool.slice(0, pool.length - 1).map((p) => p.id);
    const chosen = selectPuzzle({
      repository: mockRepo(many),
      filters: { ratingMin: band.ratingMin, ratingMax: band.ratingMax },
      excludeIds,
      seed: 7,
    });
    assert.ok(chosen);
    assert.equal(chosen!.id, pool[pool.length - 1]!.id);
  });
});
