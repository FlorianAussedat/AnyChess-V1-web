/**
 * Light PGN index + selective import (max 10 games from huge multi-game files).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractPgnSlice,
  filterPgnGameIndex,
  formatPgnGameIndexTitle,
  indexPgnGamesLight,
  togglePgnGameSelection,
} from '../indexPgnGamesLight.ts';
import { importSelectedPgnGames } from '../importSelectedPgnGames.ts';
import { parsePgn } from '../../repertoire/pgnParser.ts';

function miniGame(i: number, opts?: { white?: string; black?: string; event?: string; date?: string }): string {
  const white = opts?.white ?? `White${i}`;
  const black = opts?.black ?? `Black${i}`;
  const event = opts?.event ?? `Event${i}`;
  const date = opts?.date ?? `1990.01.${String((i % 28) + 1).padStart(2, '0')}`;
  return `[Event "${event}"]\n[White "${white}"]\n[Black "${black}"]\n[Date "${date}"]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 1-0\n`;
}

describe('indexPgnGamesLight', () => {
  it('indexes a single-game PGN with headers and offsets', () => {
    const pgn = miniGame(0, {
      white: 'Kasparov',
      black: 'Karpov',
      event: 'World Championship',
      date: '1985.10.15',
    });
    const { entries } = indexPgnGamesLight(pgn);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]!.white, 'Kasparov');
    assert.equal(entries[0]!.black, 'Karpov');
    assert.equal(entries[0]!.event, 'World Championship');
    assert.equal(entries[0]!.date, '1985.10.15');
    assert.equal(entries[0]!.result, '1-0');
    assert.equal(entries[0]!.startOffset, 0);
    assert.ok(entries[0]!.endOffset > entries[0]!.startOffset);
    const title = formatPgnGameIndexTitle(entries[0]!);
    assert.match(title, /Kasparov/);
    assert.match(title, /Karpov/);
  });

  it('indexes 20 games without building GameTrees', () => {
    const pgn = Array.from({ length: 20 }, (_, i) => miniGame(i)).join('\n');
    const { entries } = indexPgnGamesLight(pgn);
    assert.equal(entries.length, 20);
    // Slices are independent valid PGNs
    for (const e of entries) {
      const slice = extractPgnSlice(pgn, e);
      assert.match(slice, /\[White /);
      assert.match(slice, /1\. e4/);
    }
  });

  it('indexes ~50_000 games lightly (headers only)', () => {
    const N = 50_000;
    const pgn = Array.from({ length: N }, (_, i) => miniGame(i)).join('\n');
    const { entries, indexedMs } = indexPgnGamesLight(pgn);
    assert.equal(entries.length, N);
    assert.ok(indexedMs >= 0);
    // Spot-check first / middle / last
    assert.equal(entries[0]!.white, 'White0');
    assert.equal(entries[25_000]!.white, 'White25000');
    assert.equal(entries[N - 1]!.white, `White${N - 1}`);
    // Index must not allocate movetext fields
    assert.equal('movetext' in entries[0]!, false);
  });

  it('falls back to Partie N when players are missing', () => {
    const pgn = `[Event "?"]\n[Result "*"]\n\n1. e4 1-0\n`;
    const { entries } = indexPgnGamesLight(pgn);
    assert.equal(formatPgnGameIndexTitle(entries[0]!), 'Partie 1');
  });
});

describe('filterPgnGameIndex', () => {
  const pgn = [
    miniGame(0, { white: 'Kasparov', black: 'Karpov', event: 'World Championship', date: '1985.10.15' }),
    miniGame(1, { white: 'Carlsen', black: 'Nepomniachtchi', event: 'Candidates', date: '2021.04.01' }),
    miniGame(2, { white: 'Anand', black: 'Kasparov', event: 'PCA', date: '1995.09.11' }),
  ].join('\n');
  const { entries } = indexPgnGamesLight(pgn);

  it('filters by White', () => {
    const hits = filterPgnGameIndex(entries, 'Carlsen');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.white, 'Carlsen');
  });

  it('filters by Black', () => {
    const hits = filterPgnGameIndex(entries, 'Karpov');
    assert.equal(hits.length, 1);
    assert.equal(hits[0]!.black, 'Karpov');
  });

  it('filters by Event', () => {
    const hits = filterPgnGameIndex(entries, 'Candidates');
    assert.equal(hits.length, 1);
  });

  it('filters by Date', () => {
    const hits = filterPgnGameIndex(entries, '1985');
    assert.equal(hits.length, 1);
  });

  it('matches Kasparov as White or Black', () => {
    const hits = filterPgnGameIndex(entries, 'Kasparov');
    assert.equal(hits.length, 2);
  });
});

describe('togglePgnGameSelection', () => {
  it('caps at 10 and does not replace existing selections', () => {
    let selected = new Set<number>();
    for (let i = 0; i < 10; i += 1) {
      const r = togglePgnGameSelection(selected, i, 10);
      assert.equal(r.blocked, false);
      selected = r.selected;
    }
    assert.equal(selected.size, 10);
    const blocked = togglePgnGameSelection(selected, 99, 10);
    assert.equal(blocked.blocked, true);
    assert.equal(blocked.selected.size, 10);
    assert.equal(blocked.selected.has(99), false);
    assert.equal(blocked.selected.has(0), true);
  });
});

describe('importSelectedPgnGames', () => {
  it('parses only the selected games', () => {
    const pgn = Array.from({ length: 20 }, (_, i) => miniGame(i)).join('\n');
    const { entries } = indexPgnGamesLight(pgn);
    const result = importSelectedPgnGames(pgn, entries, [0, 5, 19]);
    assert.equal(result.parsedCount, 3);
    assert.equal(result.imported.length, 3);
    assert.equal(result.imported[0]!.headers.white, 'White0');
    assert.equal(result.imported[1]!.headers.white, 'White5');
    assert.equal(result.imported[2]!.headers.white, 'White19');
  });

  it('skips an invalid selected game and continues', () => {
    const good = miniGame(0);
    const bad = `[White "W"]\n[Black "B"]\n\n1. e4 Nf3 1-0\n`; // illegal
    const good2 = miniGame(2);
    const pgn = `${good}\n${bad}\n${good2}`;
    const { entries } = indexPgnGamesLight(pgn);
    assert.equal(entries.length, 3);
    const result = importSelectedPgnGames(pgn, entries, [0, 1, 2]);
    assert.equal(result.imported.length, 2);
    assert.equal(result.skippedInvalid, 1);
    assert.equal(result.parsedCount, 3);
  });

  it('does not fully parse unselected games (slice isolation)', () => {
    const pgn = Array.from({ length: 20 }, (_, i) => miniGame(i)).join('\n');
    const { entries } = indexPgnGamesLight(pgn);
    const selected = entries[7]!;
    const slice = extractPgnSlice(pgn, selected);
    const parsed = parsePgn(slice);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0]!.headers.White, 'White7');
    // Full-file parse would return 20 — we only parse the slice.
  });
});
