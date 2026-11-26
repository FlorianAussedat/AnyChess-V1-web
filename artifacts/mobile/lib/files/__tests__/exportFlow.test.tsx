import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { setFileTransferRuntimeForTests } from '../chessFileTransfer.ts';
import { requestPgnExport } from '../presentChessExport.ts';
import {
  getAppDialogRequest,
  dismissAppDialog,
} from '../../ui/appDialogStore.ts';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { AsyncStorageRepertoireStorage } from '../../repertoire/storage/AsyncStorageRepertoireStorage.ts';
import { RepertoireService } from '../../repertoire/RepertoireService.ts';
import {
  loadEditorSessionFromPgn,
  editorGoNext,
  editorSetComment,
  editorExportPgn,
} from '../../openingStudy/openingEditorState.ts';
import { installPersonalPgnGuard } from '../../repertoire/personalPgnAccess.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
register('./fileUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { GameExportPgnModal } =
  await import('../../../components/game/GameExportPgnModal.tsx');
const { AnyLyseurExportMenu } =
  await import('../../../components/analysis/AnyLyseurExportMenu.tsx');
const { state } = await import('./fileUiRuntime.ts');
const PGN = '[Event "Offline"]\n[Result "*"]\n\n1. e4 {before} (1. d4 d5) e5 *';
afterEach(() => {
  setFileTransferRuntimeForTests(null);
  dismissAppDialog();
  installPersonalPgnGuard(null);
  state.language = 'fr';
});
function choose(id: string) {
  const action = getAppDialogRequest()!.actions!.find(
    (action) => action.testID === id,
  )!;
  dismissAppDialog();
  action.onPress();
}
describe('export UI and existing offline editing', () => {
  it('keeps the game modal and its data on unavailable Android export, then permits a real copy', async () => {
    let copies = '',
      closed = 0;
    setFileTransferRuntimeForTests({
      platform: 'android',
      files: null,
      shareText: async () => 'cancelled',
      copyText: async (text) => {
        copies = text;
        return true;
      },
    });
    let view!: ReturnType<typeof create>;
    await act(async () => {
      view = create(
        <GameExportPgnModal
          visible
          body="PGN"
          exportedText={PGN}
          exportPgn={() => PGN}
          downloadPgn={() => requestPgnExport('game.pgn', PGN)}
          onClose={() => {
            closed++;
          }}
        />,
      );
    });
    const exportButton = () =>
      view.root.findByProps({ testID: 'game-export-file-actions' });
    await act(async () => exportButton()!.props.onPress());
    assert.ok(
      getAppDialogRequest()?.actions?.some(
        (action) => action.testID === 'chess-export-file',
      ),
    );
    await act(async () => choose('chess-export-file'));
    assert.match(getAppDialogRequest()?.message ?? '', /ExponentFileSystem/);
    assert.doesNotMatch(
      getAppDialogRequest()?.message ?? '',
      /a été écrit|réussi/,
    );
    assert.equal(closed, 0);
    dismissAppDialog();
    await act(async () => exportButton()!.props.onPress());
    await act(async () => choose('chess-export-copy'));
    assert.equal(copies, PGN);
    assert.equal(closed, 0);
    await act(async () => view.unmount());
  });
  it('reports a cancelled native file picker with no success or error dialog', async () => {
    setFileTransferRuntimeForTests({
      platform: 'android',
      files: {
        requestDirectoryPermissionsAsync: async () => ({ granted: false }),
        createSAFFileAsync: async () => '',
        writeAsStringAsync: async () => {},
      },
      shareText: async () => 'cancelled',
      copyText: async () => true,
    });
    const pending = requestPgnExport('game.pgn', PGN);
    choose('chess-export-file');
    assert.equal((await pending).kind, 'cancelled');
    assert.equal(getAppDialogRequest(), null);
  });
  it('names file saving, copy and text sharing separately in both languages and disables duplicate actions', async () => {
    for (const language of ['fr', 'en'] as const) {
      state.language = language;
      let view!: ReturnType<typeof create>;
      await act(async () => {
        view = create(
          <AnyLyseurExportMenu
            visible
            busy
            status="Export unavailable"
            includeEvals
            onClose={() => {}}
            onIncludeEvalsChange={() => {}}
            onCopyPgn={() => {}}
            onDownloadPgn={() => {}}
            onCopyFen={() => {}}
            onDownloadFen={() => {}}
            onSharePgn={() => {}}
            onShareFen={() => {}}
          />,
        );
      });
      for (const id of [
        'download-pgn',
        'download-fen',
        'copy-pgn',
        'copy-fen',
        'share-pgn',
        'share-fen',
      ])
        assert.equal(
          view.root.findByProps({ testID: `anyliseur-export-${id}` }).props
            .disabled,
          true,
        );
      assert.equal(view.root.findByProps({ testID: 'anyliseur-export-status' }).props.children, 'Export unavailable');
      const text = JSON.stringify(view.toJSON());
      assert.ok(
        text.includes(
          language === 'fr' ? 'Partager le texte PGN' : 'Share PGN text',
        ),
      );
      assert.ok(
        text.includes(
          language === 'fr' ? 'Enregistrer le fichier FEN' : 'Save FEN file',
        ),
      );
      await act(async () => view.unmount());
    }
  });
  it('edits and persists a local opening offline, retains its ID and branches, and rejects another account before writing', async () => {
    const kv = new MemoryKeyValueStorage();
    const storage = new AsyncStorageRepertoireStorage(kv);
    const library = new RepertoireService(storage);
    const folder = await library.getUnfiledFolderId();
    const file = await library.importPgn(folder, 'local.pgn', PGN);
    const duplicate = await library.importPgn(folder, 'local.pgn', PGN);
    assert.notEqual(duplicate.id, file.id);
    assert.notEqual(duplicate.filename, file.filename);
    let editor = loadEditorSessionFromPgn({
      pgnText: file.pgnText,
      folderId: folder,
      fileId: file.id,
      displayName: 'Offline',
    });
    editor = editorSetComment(editorGoNext(editor), 'edited offline');
    await library.replacePgn(file.id, editorExportPgn(editor));
    const restarted = new RepertoireService(
      new AsyncStorageRepertoireStorage(kv),
    );
    await restarted.ensureLoaded();
    const restored = restarted
      .getAllFiles()
      .find((item) => item.id === file.id)!;
    assert.match(restored.pgnText, /edited offline/);
    const parsed = parseReaderPgn(restored.pgnText);
    assert.ok(parsed.ok);
    if (parsed.ok) assert.equal(parsed.game.hasVariations, true);
    const before = JSON.stringify(await storage.load());
    installPersonalPgnGuard(() => {
      throw Error('other account');
    });
    await assert.rejects(restarted.replacePgn(file.id, 'bad'), /other account/);
    assert.equal(JSON.stringify(await storage.load()), before);
  });
  it('does not leave an import or replacement applied when local persistence fails', async () => {
    const kv = new MemoryKeyValueStorage();
    const storage = new AsyncStorageRepertoireStorage(kv);
    const library = new RepertoireService(storage);
    const folder = await library.getUnfiledFolderId();
    const file = await library.importPgn(folder, 'original.pgn', PGN);
    const before = JSON.stringify(await storage.load());
    const save = storage.save.bind(storage);
    storage.save = async () => {
      throw Error('disk full');
    };
    await assert.rejects(
      library.importPgn(folder, 'new.pgn', PGN),
      /disk full/,
    );
    assert.equal(library.getAllFiles().length, 1);
    await assert.rejects(
      library.replacePgn(file.id, PGN.replace('before', 'changed')),
      /disk full/,
    );
    assert.equal(library.getAllFiles()[0]!.pgnText, PGN);
    assert.equal(JSON.stringify(await storage.load()), before);
    storage.save = save;
    await library.replacePgn(file.id, PGN.replace('before', 'changed'));
    assert.match(library.getAllFiles()[0]!.pgnText, /changed/);
  });
});
