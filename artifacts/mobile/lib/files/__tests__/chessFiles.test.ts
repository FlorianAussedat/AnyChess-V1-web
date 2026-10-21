import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Chess } from 'chess.js';
import {
  transferChessText,
  setFileTransferRuntimeForTests,
  type FileTransferRuntime,
} from '../chessFileTransfer.ts';
import {
  downloadPgnFile,
  downloadFenFile,
  exportGamePgn,
} from '../../pgn/PgnExporter.ts';
import { readPgnAsset } from '../readPgnFile.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import { exportEnrichedPgn } from '../../analysis/exportEnrichedPgn.ts';
const PGN =
  '[Event "Club"]\n[Site "Paris"]\n[Round "7"]\n[White "Ada"]\n[Black "Alan"]\n[Result "*"]\n[Annotator "A"]\n\n{Before} 1. e4 $1 {main} (1. d4 d5 {side}) e5 2. Nf3 (2. Bc4 $5 {nested}) *';
function runtime(
  overrides: Partial<FileTransferRuntime> = {},
): FileTransferRuntime {
  return {
    platform: 'android',
    files: null,
    shareText: async () => 'shared',
    copyText: async () => true,
    ...overrides,
  };
}
afterEach(() => setFileTransferRuntimeForTests(null));

describe('real file actions and explicit outcomes', () => {
  it('creates a downloadable Web blob with a correct extension, without claiming disk persistence', async () => {
    const clicked: string[] = [],
      blobs: Blob[] = [];
    const anchor = {
      href: '',
      download: '',
      remove() {},
      click() {
        clicked.push(this.download);
      },
    };
    setFileTransferRuntimeForTests(
      runtime({
        platform: 'web',
        document: {
          createElement: () => anchor,
          body: { appendChild() {} },
        } as unknown as Document,
        urls: {
          createObjectURL: (blob: Blob) => {
            blobs.push(blob);
            return 'blob:test';
          },
          revokeObjectURL() {},
        } as typeof URL,
      }),
    );
    assert.equal(
      (await downloadPgnFile('game.PGN', PGN)).kind,
      'downloadStarted',
    );
    assert.deepEqual(clicked, ['game.pgn']);
    assert.equal(await blobs[0]!.text(), PGN);
  });
  it('writes a genuine Android SAF file and reimports its bytes via content://', async () => {
    const disk = new Map<string, string>();
    let filename = '',
      mime = '';
    const files = {
      requestDirectoryPermissionsAsync: async () => ({
        granted: true,
        directoryUri: 'content://downloads',
      }),
      createSAFFileAsync: async (
        _directory: string,
        name: string,
        type: string,
      ) => {
        filename = name;
        mime = type;
        return 'content://downloads/game.pgn';
      },
      writeAsStringAsync: async (uri: string, text: string) => {
        disk.set(uri, text);
      },
      readAsStringAsync: async (uri: string) => disk.get(uri)!,
    };
    setFileTransferRuntimeForTests(runtime({ files }));
    assert.equal((await downloadPgnFile('game', PGN)).kind, 'saved');
    assert.equal(filename, 'game.pgn');
    assert.equal(mime, 'application/x-chess-pgn');
    const imported = await readPgnAsset(
      { name: filename, uri: 'content://downloads/game.pgn' },
      files,
    );
    assert.equal(imported.text, PGN);
    assert.ok(parseReaderPgn(imported.text).ok);
  });
  it('distinguishes missing module, picker cancellation, write errors, text sharing and copy', async () => {
    setFileTransferRuntimeForTests(runtime());
    assert.equal((await downloadPgnFile('x', PGN)).kind, 'unavailable');
    assert.equal(
      (await transferChessText('copy', 'x', PGN, 'pgn')).kind,
      'copied',
    );
    assert.equal(
      (await transferChessText('share', 'x', PGN, 'pgn')).kind,
      'sharedText',
    );
    setFileTransferRuntimeForTests(
      runtime({
        files: {
          requestDirectoryPermissionsAsync: async () => ({ granted: false }),
          createSAFFileAsync: async () => 'unused',
          writeAsStringAsync: async () => {},
        },
      }),
    );
    assert.equal((await downloadPgnFile('x', PGN)).kind, 'cancelled');
    let deleted = '';
    setFileTransferRuntimeForTests(
      runtime({
        files: {
          requestDirectoryPermissionsAsync: async () => ({
            granted: true,
            directoryUri: 'folder',
          }),
          createSAFFileAsync: async () => 'new-file',
          writeAsStringAsync: async () => {
            throw Error('full');
          },
          deleteAsync: async (uri) => {
            deleted = uri;
          },
        },
      }),
    );
    assert.equal((await downloadPgnFile('x', PGN)).kind, 'failed');
    assert.equal(deleted, 'new-file'); // Never deletes any existing PGN.
  });
  it('prevents concurrent exports and releases the lock after cancellation', async () => {
    let release!: (value: 'cancelled') => void;
    setFileTransferRuntimeForTests(
      runtime({
        shareText: () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      }),
    );
    const pending = transferChessText('share', 'x', PGN, 'pgn');
    assert.equal((await downloadPgnFile('x', PGN)).kind, 'busy');
    release('cancelled');
    assert.equal((await pending).kind, 'cancelled');
    assert.equal((await downloadPgnFile('x', PGN)).kind, 'unavailable');
  });
  it('exports the selected current FEN with .fen, keeping side, castling, en passant and counters', async () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('e5');
    chess.move('Nf3');
    const fen = chess.fen();
    let name = '',
      contents = '';
    setFileTransferRuntimeForTests(
      runtime({
        files: {
          requestDirectoryPermissionsAsync: async () => ({
            granted: true,
            directoryUri: 'd',
          }),
          createSAFFileAsync: async (_d, n) => {
            name = n;
            return 'new';
          },
          writeAsStringAsync: async (_uri, text) => {
            contents = text;
          },
        },
      }),
    );
    assert.equal((await downloadFenFile('position.fen', fen)).kind, 'saved');
    assert.equal(name, 'position.fen');
    assert.equal(contents, fen);
    assert.equal(new Chess(contents).fen(), chess.fen());
    assert.notEqual(contents, new Chess().fen());
    assert.equal((await downloadFenFile('x', 'invalid')).kind, 'failed');
  });
});

describe('PGN integrity', () => {
  it('round-trips all branches, authored comments, NAGs and original headers', () => {
    const parsed = parseReaderPgn(PGN);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const exported = exportEnrichedPgn({
      game: parsed.game,
      includeEvals: false,
    });
    const reimported = parseReaderPgn(exported);
    assert.ok(reimported.ok);
    if (!reimported.ok) return;
    assert.equal(
      Object.keys(reimported.game.nodesById).length,
      Object.keys(parsed.game.nodesById).length,
    );
    for (const text of [
      'Club',
      'Paris',
      'Before',
      'main',
      'side',
      'nested',
      '[Round "7"]',
      '[Annotator "A"]',
      '$1',
      '$5',
    ])
      assert.ok(exported.includes(text), text);
  });
  it('exports black-to-move positions with correct fullmove number, SetUp and FEN', () => {
    const chess = new Chess(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 7',
    );
    const initial = chess.fen();
    chess.move('e5');
    chess.move('Nf3');
    const exported = exportGamePgn({
      headers: { White: 'W', Black: 'B' },
      moves: chess.history({ verbose: true }),
    });
    assert.ok(exported.includes('[SetUp "1"]'));
    assert.ok(exported.includes(initial));
    assert.ok(exported.includes('7... e5 8. Nf3'));
    const restored = new Chess();
    restored.loadPgn(exported);
    assert.equal(restored.fen(), chess.fen());
  });
  it('adds requested Stockfish evaluations without removing authored comments', () => {
    const parsed = parseReaderPgn(PGN);
    assert.ok(parsed.ok);
    if (!parsed.ok) return;
    const id = parsed.game.rootIds[0]!;
    const exported = exportEnrichedPgn({
      game: parsed.game,
      includeEvals: true,
      nodes: { [id]: { evaluation: 35 } as any },
    });
    assert.ok(exported.includes('[%eval 0.35]'));
    assert.ok(exported.includes('main'));
    assert.ok(parseReaderPgn(exported).ok);
  });
});
