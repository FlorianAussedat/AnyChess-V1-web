import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importPgnGames } from '../../gameLibrary/importPgnGames.ts';
import { workspacePayloadFromImportedGame } from '../buildWorkspacePayload.ts';
import { initialOrientationFromFen } from '../boardOrientation.ts';
import {
  createTreeFromPayload,
  currentNode,
  goEnd,
  goNext,
  goStart,
  mainlineMoves,
  sideFromFen,
} from '../variantTree.ts';
import type { ChessWorkspacePayload, WorkspaceResult } from '../types.ts';

const START =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function resultFromHeader(raw?: string): WorkspaceResult {
  if (raw === '1-0') return { type: 'win', raw };
  if (raw === '0-1') return { type: 'loss', raw };
  if (raw === '1/2-1/2') return { type: 'draw', raw };
  return { type: 'unfinished', raw: raw ?? '*' };
}

function openPgn(pgn: string) {
  const imported = importPgnGames(pgn);
  assert.equal(imported.imported.length, 1, imported.errors.join('; '));
  const game = imported.imported[0]!;
  const payload = workspacePayloadFromImportedGame({
    game,
    orientation: initialOrientationFromFen(game.initialFen),
    title: `${game.headers.white ?? 'W'} vs ${game.headers.black ?? 'B'}`,
    result: resultFromHeader(game.headers.result),
  });
  const tree = createTreeFromPayload(payload);
  return { imported, game, payload, tree };
}

function assertWorkspaceOnlyReader(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const readerPath = join(here, '../../../app/parties/[gameId].tsx');
  const workspacePath = join(here, '../../../app/parties/workspace.tsx');
  const reader = readFileSync(readerPath, 'utf8');
  const workspace = readFileSync(workspacePath, 'utf8');
  assert.match(reader, /UniversalChessWorkspace/);
  assert.match(workspace, /UniversalChessWorkspace/);
  assert.doesNotMatch(reader, /createPlaybackSnapshot/);
  assert.doesNotMatch(reader, /GamePlaybackScheduler/);
  assert.doesNotMatch(workspace, /createPlaybackSnapshot/);
}

test('standard starting position', () => {
  const pgn = `[White "Alice"]
[Black "Bob"]
[Result "*"]

1. e4 e5 *
`;
  const { game, payload, tree } = openPgn(pgn);
  assert.equal(game.initialFen, START);
  assert.equal(payload.initialFen, START);
  assert.equal(sideFromFen(currentNode(tree).fen), 'white');
  assert.equal(payload.orientation, 'white');
  assert.deepEqual(mainlineMoves(tree).map((m) => m.san), ['e4', 'e5']);
  const afterFirst = goNext(tree);
  assert.match(currentNode(afterFirst).fen, /4P3/);
});

test('[SetUp "1"] and [FEN] custom start', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1';
  const pgn = `[SetUp "1"]
[FEN "${fen}"]
[White "W"]
[Black "B"]
[Result "*"]

1. e4 *
`;
  const { game, payload, tree } = openPgn(pgn);
  assert.equal(game.initialFen, fen);
  assert.equal(payload.initialFen, fen);
  assert.equal(mainlineMoves(tree)[0]?.san, 'e4');
});

test('black to move and black orientation', () => {
  const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 1';
  const pgn = `[SetUp "1"]
[FEN "${fen}"]
[Result "*"]

1... Ke7 *
`;
  const { payload, tree } = openPgn(pgn);
  assert.equal(sideFromFen(payload.initialFen), 'black');
  assert.equal(payload.orientation, 'black');
  assert.equal(currentNode(tree).fen, fen);
  assert.equal(goNext(tree).nodesById[goNext(tree).currentNodeId]?.moveFromParent?.san, 'Ke7');
});

test('kingside and queenside castling', () => {
  const castleFen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const pgn = `[SetUp "1"]
[FEN "${castleFen}"]
[Result "*"]

1. O-O O-O-O *
`;
  const { tree } = openPgn(pgn);
  assert.deepEqual(mainlineMoves(tree).map((m) => m.san), ['O-O', 'O-O-O']);
});

test('promotion', () => {
  const fen = '8/4P2k/8/8/8/8/8/4K3 w - - 0 1';
  const pgn = `[SetUp "1"]
[FEN "${fen}"]
[Result "1-0"]

1. e8=Q *
`;
  const { tree, payload } = openPgn(pgn);
  assert.equal(mainlineMoves(tree)[0]?.san, 'e8=Q');
  assert.equal(payload.result?.type, 'win');
});

test('en passant', () => {
  const pgn = `[White "W"]
[Black "B"]
[Result "*"]

1. e4 a6 2. e5 d5 3. exd6 *
`;
  const { tree } = openPgn(pgn);
  const sans = mainlineMoves(tree).map((m) => m.san);
  assert.ok(sans.includes('exd6'));
});

test('white wins', () => {
  const pgn = `[White "W"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0
`;
  const { payload, tree } = openPgn(pgn);
  assert.equal(payload.result?.raw, '1-0');
  assert.equal(payload.result?.type, 'win');
  const end = goEnd(tree);
  assert.ok(mainlineMoves(end).at(-1)?.san.includes('xf7'));
});

test('black wins', () => {
  const pgn = `[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
`;
  const { payload } = openPgn(pgn);
  assert.equal(payload.result?.raw, '0-1');
  assert.equal(payload.result?.type, 'loss');
});

test('draw result', () => {
  const pgn = `[Event "Drawish"]
[Result "1/2-1/2"]

1. e4 e5 1/2-1/2
`;
  const { payload } = openPgn(pgn);
  assert.equal(payload.result?.raw, '1/2-1/2');
  assert.equal(payload.result?.type, 'draw');
});

test('unfinished game', () => {
  const pgn = `[Result "*"]

1. e4 *
`;
  const { payload } = openPgn(pgn);
  assert.equal(payload.result?.type, 'unfinished');
});

test('invalid PGN is rejected', () => {
  const imported = importPgnGames(`[White "W"]\n[Black "B"]\n\n1. e4 e4 1-0\n`);
  assert.equal(imported.imported.length, 0);
  assert.ok(imported.skippedInvalid >= 1);
});

test('long PGN builds a complete mainline', () => {
  const pgn = `[White "W"]
[Black "B"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7
6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 *
`;
  const { tree } = openPgn(pgn);
  assert.equal(mainlineMoves(tree).length, 20);
  const start = goStart(tree);
  let cursor = start;
  for (let i = 0; i < 20; i += 1) cursor = goNext(cursor);
  assert.equal(currentNode(cursor).ply, 20);
});

test('metadata headers are preserved', () => {
  const pgn = `[Event "World Championship"]
[Site "Reykjavik"]
[Date "1972.07.11"]
[Round "6"]
[White "Fischer"]
[Black "Spassky"]
[WhiteElo "2785"]
[ECO "D59"]
[Result "1-0"]

1. c4 1-0
`;
  const { game, payload } = openPgn(pgn);
  assert.equal(game.headers.white, 'Fischer');
  assert.equal(game.headers.black, 'Spassky');
  assert.equal(game.headers.event, 'World Championship');
  assert.equal(game.headers.eco, 'D59');
  assert.equal((payload.metadata as { headers?: { white?: string } })?.headers?.white, 'Fischer');
});

test('FEN-only PGN with SetUp and no moves still opens', () => {
  const fen = '8/8/8/4k3/8/8/8/4K2Q w - - 0 1';
  const pgn = `[SetUp "1"]
[FEN "${fen}"]
[Result "*"]

*
`;
  const { game, payload, tree } = openPgn(pgn);
  assert.equal(game.initialFen, fen);
  assert.equal(payload.initialFen, fen);
  assert.equal(mainlineMoves(tree).length, 0);
  assert.equal(currentNode(tree).fen, fen);
});

test('PGN games open only through UniversalChessWorkspace', () => {
  assertWorkspaceOnlyReader();
});
