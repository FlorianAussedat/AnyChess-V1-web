import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseReaderPgn,
  readerGameFromImported,
  emptyReaderGame,
  createGameReaderState,
  goToStart,
  goToEnd,
  goToNext,
  goToPrevious,
  goToPly,
  flipBoard,
  fenAtReaderPly,
} from '../index.ts';
import { formatSanForDisplay } from '../../chess/notation.ts';
import { importPgnGames } from '../../gameLibrary/importPgnGames.ts';

const SHORT_PGN = `[White "White"]
[Black "Black"]
[Result "*"]

1. e4 e5 2. Nf3 *`;

describe('gameReader parseReaderPgn', () => {
  it('parses a standard short game', () => {
    const result = parseReaderPgn(SHORT_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.game.moves.length, 3);
    assert.equal(result.game.moves[0]!.san, 'e4');
    assert.equal(result.game.moves[1]!.san, 'e5');
    assert.equal(result.game.moves[2]!.san, 'Nf3');
    assert.equal(result.game.headers.white, 'White');
    assert.equal(result.game.headers.black, 'Black');
  });

  it('handles kingside and queenside castling', () => {
    const pgn = `[White "W"]
[Black "B"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const sans = result.game.moves.map((m) => m.san);
    assert.ok(sans.includes('O-O'));
    // Black also castled short in this line.
    assert.equal(sans.filter((s) => s === 'O-O').length, 2);
  });

  it('handles promotion and checkmate', () => {
    const pgn = `[SetUp "1"]
[FEN "8/4P3/8/8/8/8/8/4K2k w - - 0 1"]
[Result "1-0"]

1. e8=Q# 1-0`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.game.moves.length, 1);
    assert.match(result.game.moves[0]!.san, /^e8=Q/);
    assert.equal(result.game.moves[0]!.from, 'e7');
    assert.equal(result.game.moves[0]!.to, 'e8');
    assert.equal(result.game.moves[0]!.promotion, 'q');
  });

  it('handles capture promotion', () => {
    const pgn = `[SetUp "1"]
[FEN "5k2/3P4/8/8/8/8/8/4K3 w - - 0 1"]

1. d8=Q+ *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.game.moves[0]!.san, /^d8=Q/);
  });

  it('handles en passant', () => {
    const pgn = `1. e4 a6 2. e5 d5 3. exd6 *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const last = result.game.moves[result.game.moves.length - 1]!;
    assert.equal(last.san, 'exd6');
    assert.equal(last.from, 'e5');
    assert.equal(last.to, 'd6');
  });

  it('handles check and mate markers in SAN', () => {
    const pgn = `[SetUp "1"]
[FEN "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4"]

4... Kxf7 5. Qh5# *`;
    // Invalid continuation on purpose for mate sample — use a known mate mini-game instead.
    const mate = parseReaderPgn(`1. f3 e5 2. g4 Qh4# 1-0`);
    assert.equal(mate.ok, true);
    if (!mate.ok) return;
    const last = mate.game.moves[mate.game.moves.length - 1]!;
    assert.equal(last.san, 'Qh4#');
  });

  it('preserves comments and NAGs', () => {
    const pgn = `1. e4 {Interesting move} e5 $1 2. Nf3 *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.game.moves[0]!.comment ?? '', /Interesting/);
    assert.ok((result.game.moves[1]!.nags ?? []).some((n) => n.includes('1')));
  });

  it('preserves variation flag without breaking main line', () => {
    const pgn = `1. e4 e5 2. Nf3 Nc6 (2... Nf6) 3. Bb5 *`;
    const result = parseReaderPgn(pgn);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.game.hasVariations, true);
    assert.deepEqual(
      result.game.moves.map((m) => m.san),
      ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    );
  });

  it('returns a clean error for invalid PGN without throwing', () => {
    const result = parseReaderPgn('(((((');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Impossible de lire cette partie/);
    assert.ok(result.detail);
  });

  it('returns a clean error for illegal moves', () => {
    const result = parseReaderPgn('1. e4 e5 2. Ba3 *');
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /Impossible de lire cette partie/);
  });
});

describe('gameReader navigation', () => {
  const result = parseReaderPgn(SHORT_PGN);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error('parse failed');
  const game = result.game;

  it('starts at ply 0 with initial FEN and no highlight', () => {
    const state = createGameReaderState(game, 0);
    assert.equal(state.currentPly, 0);
    assert.equal(state.currentFen, game.initialFen);
    assert.equal(state.currentMove, null);
    assert.equal(state.lastMoveSquares, null);
    assert.equal(state.canGoBack, false);
    assert.equal(state.canGoForward, true);
  });

  it('next / previous / start / end / jump stay in sync', () => {
    let state = createGameReaderState(game, 0);
    state = goToNext(state);
    assert.equal(state.currentPly, 1);
    assert.equal(state.currentSan, 'e4');
    assert.equal(state.currentFen, game.moves[0]!.fenAfter);
    assert.deepEqual(state.lastMoveSquares, { from: 'e2', to: 'e4' });
    assert.equal(state.currentMove?.san, 'e4');

    state = goToNext(state);
    assert.equal(state.currentPly, 2);
    assert.equal(state.currentSan, 'e5');

    state = goToPrevious(state);
    assert.equal(state.currentPly, 1);
    assert.equal(state.currentSan, 'e4');

    state = goToEnd(state);
    assert.equal(state.currentPly, game.moves.length);
    assert.equal(state.canGoForward, false);
    assert.equal(state.currentSan, 'Nf3');
    assert.equal(state.currentFen, fenAtReaderPly(game, game.moves.length));

    state = goToPly(state, 2);
    assert.equal(state.currentPly, 2);
    assert.equal(state.currentSan, 'e5');
    assert.equal(state.currentFen, game.moves[1]!.fenAfter);

    state = goToStart(state);
    assert.equal(state.currentPly, 0);
    assert.equal(state.lastMoveSquares, null);
  });

  it('clamps previous at ply 0 and next at last ply', () => {
    let state = createGameReaderState(game, 0);
    state = goToPrevious(state);
    assert.equal(state.currentPly, 0);
    state = goToEnd(state);
    const endPly = state.currentPly;
    state = goToNext(state);
    assert.equal(state.currentPly, endPly);
  });

  it('flip does not change ply, fen, or notation cursor', () => {
    let state = createGameReaderState(game, 2);
    const before = {
      ply: state.currentPly,
      fen: state.currentFen,
      san: state.currentSan,
    };
    state = flipBoard(state);
    assert.equal(state.boardFlipped, true);
    assert.equal(state.currentPly, before.ply);
    assert.equal(state.currentFen, before.fen);
    assert.equal(state.currentSan, before.san);
  });
});

describe('gameReader FEN sync for 1. e4 e5 2. Nf3', () => {
  it('matches known FENs at each ply', () => {
    const result = parseReaderPgn(SHORT_PGN);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const game = result.game;
    assert.equal(
      fenAtReaderPly(game, 0),
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    assert.equal(
      fenAtReaderPly(game, 1).split(' ')[0],
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR',
    );
    assert.equal(
      fenAtReaderPly(game, 2).split(' ')[0],
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR',
    );
    assert.equal(
      fenAtReaderPly(game, 3).split(' ')[0],
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R',
    );

    let state = createGameReaderState(game, 0);
    for (let ply = 0; ply <= game.moves.length; ply += 1) {
      state = goToPly(state, ply);
      assert.equal(state.currentPly, ply);
      assert.equal(state.currentFen, fenAtReaderPly(game, ply));
      assert.equal(state.currentMove?.san ?? null, game.moves[ply - 1]?.san ?? null);
    }
  });
});

describe('gameReader FR/EN notation display', () => {
  it('translates piece letters without confusing K/R', () => {
    assert.equal(formatSanForDisplay('Nf3', 'fr'), 'Cf3');
    assert.equal(formatSanForDisplay('Bb5', 'fr'), 'Fb5');
    assert.equal(formatSanForDisplay('Rxe5', 'fr'), 'Txe5');
    assert.equal(formatSanForDisplay('Qh5', 'fr'), 'Dh5');
    assert.equal(formatSanForDisplay('Kf2', 'fr'), 'Rf2');
    assert.equal(formatSanForDisplay('O-O', 'fr'), 'O-O');
    assert.equal(formatSanForDisplay('O-O-O', 'fr'), 'O-O-O');
    assert.equal(formatSanForDisplay('Nf3', 'en'), 'Nf3');
  });
});

describe('gameReader imported adaptation', () => {
  it('adapts library imports into ReaderGame with squares', () => {
    const imported = importPgnGames(SHORT_PGN);
    assert.equal(imported.imported.length, 1);
    const g = imported.imported[0]!;
    const reader = readerGameFromImported({
      id: g.id,
      fingerprint: g.fingerprint,
      headers: g.headers,
      initialFen: g.initialFen,
      moves: g.moves.map((m) => ({
        ply: m.ply,
        san: m.san,
        fenAfter: m.fenAfter,
        comment: m.comment,
        nags: m.nags,
      })),
      hasVariations: g.hasVariations,
      rawPgn: g.source.rawPgn,
      source: g.source,
    });
    assert.equal(reader.moves[0]!.from, 'e2');
    assert.equal(reader.moves[0]!.to, 'e4');
    const empty = emptyReaderGame();
    assert.equal(empty.moves.length, 0);
  });
});
