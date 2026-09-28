/**
 * System “À classer” folder + save-on-demand for game analyses.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Chess } from 'chess.js';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { GameLibraryStore } from '../GameLibraryStore.ts';
import { isUnfiledGameFolder, UNFILED_GAME_FOLDER_ID } from '../unfiledFolder.ts';
import { validateAnalysisFen } from '../validateAnalysisFen.ts';
import { saveReaderGameToLibrary } from '../saveReaderGameToLibrary.ts';
import { emptyReaderGame, parseReaderPgn, STANDARD_START_FEN } from '../../gameReader/parseReaderPgn.ts';
import { isUnfiledOpeningFolder, UNFILED_OPENING_FOLDER_ID, makeUnfiledOpeningFolder } from '../../repertoire/unfiledFolder.ts';
import {
  setParkedAnalyzerDraft,
  takeParkedAnalyzerDraft,
  __resetParkedAnalyzerDraftForTests,
} from '../parkedAnalyzerDraft.ts';
import { pgnFromFenAndSans } from '../pgnFromFenAndSans.ts';
import { selectedPgnSlices, preparePgnSource } from '../../pgnImport/preparePgnLoad.ts';
import { indexPgnGamesLight } from '../indexPgnGamesLight.ts';

const SAMPLE = `[Event "Test"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0
`;

const MULTI = `${SAMPLE}

[Event "Second"]
[White "C"]
[Black "D"]
[Result "0-1"]

1. d4 d5 0-1
`;

describe('game library À classer', () => {
  it('creates a permanent unfiled folder on load', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const snap = await store.getSnapshot();
    const unfiled = snap.folders.find((f) => isUnfiledGameFolder(f));
    assert.ok(unfiled);
    assert.equal(unfiled!.id, UNFILED_GAME_FOLDER_ID);
    assert.equal(unfiled!.name, 'À classer');
    const listed = await store.listFolders(null);
    assert.equal(listed[0]?.id, UNFILED_GAME_FOLDER_ID);
  });

  it('refuses to delete or rename À classer', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    await store.getSnapshot();
    await assert.rejects(() => store.deleteFolder(UNFILED_GAME_FOLDER_ID));
    const renamed = await store.renameFolder(UNFILED_GAME_FOLDER_ID, 'Inbox');
    assert.equal(renamed, null);
    const again = await store.getFolder(UNFILED_GAME_FOLDER_ID);
    assert.equal(again?.name, 'À classer');
  });

  it('saves imported PGN into À classer by default', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const result = await store.importPgnText(SAMPLE, 'game.pgn');
    assert.equal(result.imported[0]?.folderId, UNFILED_GAME_FOLDER_ID);
    const inUnfiled = await store.listGames(UNFILED_GAME_FOLDER_ID);
    assert.equal(inUnfiled.length, 1);
  });

  it('moves a game out of À classer', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const result = await store.importPgnText(SAMPLE, 'game.pgn');
    const folder = await store.createFolder('Tournois');
    await store.moveGame(result.imported[0]!.id, folder.id);
    assert.equal((await store.listGames(UNFILED_GAME_FOLDER_ID)).length, 0);
    assert.equal((await store.listGames(folder.id)).length, 1);
  });
});

describe('save-on-demand analyses', () => {
  it('does not write the library when a draft is only parked', () => {
    __resetParkedAnalyzerDraftForTests();
    setParkedAnalyzerDraft({ pgnText: SAMPLE, tab: 'analysis' });
    const parked = takeParkedAnalyzerDraft();
    assert.equal(parked?.pgnText, SAMPLE);
    assert.equal(takeParkedAnalyzerDraft(), null);
  });

  it('saves a start-position analysis into À classer on demand', async () => {
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const empty = emptyReaderGame();
    assert.equal(empty.initialFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'), true);
    assert.equal((await store.listGames(UNFILED_GAME_FOLDER_ID)).length, 0);
    const saved = await saveReaderGameToLibrary({ game: empty, store });
    assert.ok(saved);
    assert.equal(saved!.folderId, UNFILED_GAME_FOLDER_ID);
    assert.equal((await store.listGames(UNFILED_GAME_FOLDER_ID)).length, 1);
  });

  it('saves a FEN analysis as a normal library game keeping startFen', async () => {
    const fen =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const checked = validateAnalysisFen(fen);
    assert.equal(checked.ok, true);
    if (!checked.ok) return;
    const chess = new Chess(checked.fen);
    assert.equal(chess.turn(), 'b');
    const game = emptyReaderGame(checked.fen);
    assert.equal(game.initialFen, chess.fen());
    const store = new GameLibraryStore(new MemoryKeyValueStorage());
    const saved = await saveReaderGameToLibrary({ game, store, displayName: 'FEN' });
    assert.ok(saved);
    assert.equal(saved!.initialFen, chess.fen());
    assert.equal(saved!.folderId, UNFILED_GAME_FOLDER_ID);
  });
});

describe('FEN / PGN validation', () => {
  it('rejects an invalid FEN', () => {
    assert.equal(validateAnalysisFen('not-a-fen').ok, false);
    assert.equal(validateAnalysisFen('8/8/8/8/8/8/8/8 w - - 0').ok, false);
  });

  it('accepts a legal FEN', () => {
    const ok = validateAnalysisFen(STANDARD_START_FEN);
    assert.equal(ok.ok, true);
  });

  it('rejects invalid pasted PGN', () => {
    const parsed = parseReaderPgn('this is not a pgn');
    assert.equal(parsed.ok, false);
  });

  it('loads a pasted PGN into a reader game without saving', () => {
    const parsed = parseReaderPgn(SAMPLE, { allowEmptyMoves: true });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.game.headers.white, 'A');
  });

  it('indexes multi-game PGN and extracts only the selected slice', () => {
    const source = preparePgnSource(MULTI, 'multi.pgn');
    assert.equal(source.entries.length, 2);
    const onlySecond = selectedPgnSlices(source, [1]);
    assert.equal(onlySecond.length, 1);
    assert.match(onlySecond[0]!.pgnText, /Event "Second"/);
    assert.doesNotMatch(onlySecond[0]!.pgnText, /Event "Test"/);
    const trees = indexPgnGamesLight(MULTI);
    assert.equal(trees.entries.length, 2);
  });
});

describe('openings À classer', () => {
  it('is a separate system folder from the game library', () => {
    const opening = makeUnfiledOpeningFolder();
    assert.equal(opening.id, UNFILED_OPENING_FOLDER_ID);
    assert.equal(opening.systemKey, 'unfiled');
    assert.equal(opening.enabled, false);
    assert.ok(isUnfiledOpeningFolder(opening));
    assert.ok(isUnfiledGameFolder({ id: UNFILED_GAME_FOLDER_ID, systemKey: 'unfiled' }));
  });
});

describe('FEN to PGN conversion', () => {
  it('keeps side-to-move when building a SetUp PGN', () => {
    const fen =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const pgn = pgnFromFenAndSans({ startFen: fen, moveSans: [] });
    assert.match(pgn, /SetUp "1"/);
    assert.match(pgn, /FEN "/);
    const parsed = parseReaderPgn(pgn, { allowEmptyMoves: true });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(new Chess(parsed.game.initialFen).turn(), 'b');
  });
});
