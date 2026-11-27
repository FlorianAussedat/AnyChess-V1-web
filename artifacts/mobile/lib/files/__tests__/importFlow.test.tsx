import { importPgnBatch } from '../../pgnImport/importPgnBatch.ts';
import assert from 'node:assert/strict';
import { beforeEach, afterEach, describe, it } from 'node:test';
import { register } from 'node:module';
import React from 'react';
import { MemoryKeyValueStorage } from '../../storage/KeyValueStorage.ts';
import { AsyncStorageRepertoireStorage } from '../../repertoire/storage/AsyncStorageRepertoireStorage.ts';
import { RepertoireService } from '../../repertoire/RepertoireService.ts';
import { parseReaderPgn } from '../../gameReader/parseReaderPgn.ts';
import { readPgnAsset, MAX_PGN_FILE_BYTES } from '../readPgnFile.ts';
import {
  getAppDialogRequest,
  dismissAppDialog,
} from '../../ui/appDialogStore.ts';
register('./fileUiLoader.mjs', import.meta.url);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { create, act } = await import('react-test-renderer');
const { PgnImportPanel } =
  await import('../../../components/library/PgnImportPanel.tsx');
const { PgnGameSelectModal } =
  await import('../../../components/parties/PgnGameSelectModal.tsx');
const { preparePickedPgnAssets } =
  await import('../../gameLibrary/pickPgnFiles.ts');
const { state } = await import('./fileUiRuntime.ts');
const game = (name: string) =>
  `[Event "${name}"]\n[White "W"]\n[Black "B"]\n[Result "*"]\n\n1. e4 {hello} (1. d4 d5) e5 *`;
let view: ReturnType<typeof create>;
beforeEach(() => {
  state.language = 'fr';
  state.cancelled = false;
  state.assets = [];
});
afterEach(async () => {
  if (view) await act(async () => view.unmount());
  dismissAppDialog();
});
async function press(id: string) {
  await act(async () => view.root.findByProps({ testID: id }).props.onPress());
}
async function selectGames(indices: number[]) {
  await act(async () => {
    const modal = view.root.findByType(PgnGameSelectModal);
    modal.props.onChangeSelected(new Set(indices.map((i) => `g-${i}`)));
  });
  await act(async () =>
    view.root.findByType(PgnGameSelectModal).props.onConfirm(),
  );
}
describe('complete multi-file import panel', () => {
  it('selects games across all files, preserves filenames/trees and imports into a nested local folder', async () => {
    const kv = new MemoryKeyValueStorage();
    const library = new RepertoireService(
      new AsyncStorageRepertoireStorage(kv),
    );
    const parent = await library.createFolder('Parent', 'white', true);
    const folder = await library.createFolder(
      'Child',
      'white',
      true,
      parent.id,
    );
    state.assets = [
      {
        name: 'first.pgn',
        file: { text: async () => game('One') + '\n\n' + game('Two') },
      },
      { name: 'second.pgn', file: { text: async () => game('Three') } },
    ];
    let loaded: any;
    await act(async () => {
      view = create(
        <PgnImportPanel
          maxGameSelection={100}
          onLoad={async (payload) => {
            loaded = payload;
            if (payload.kind === 'pgn')
              for (const item of payload.games)
                await library.importPgn(
                  folder.id,
                  item.filename!,
                  item.pgnText,
                );
          }}
        />,
      );
    });
    await press('pgn-import-pick-file');
    assert.equal(state.pickerOptions.copyToCacheDirectory, true);
    assert.equal(state.pickerOptions.multiple, true);
    assert.equal(
      view.root.findByType(PgnGameSelectModal).props.candidates.length,
      3,
    );
    await selectGames([1, 2]);
    assert.ok(view.root.findByProps({ testID: 'pgn-import-selected-games' }));
    await press('pgn-import-load');
    assert.deepEqual(
      loaded.games.map((g: any) => g.filename),
      ['first.pgn', 'second.pgn'],
    );
    const restarted = new RepertoireService(
      new AsyncStorageRepertoireStorage(kv),
    );
    await restarted.ensureLoaded();
    assert.equal(restarted.getAllFiles().length, 2);
    assert.ok(
      restarted
        .getAllFiles()
        .every(
          (file) =>
            parseReaderPgn(file.pgnText).ok && file.folderId === folder.id,
        ),
    );
    assert.match(getAppDialogRequest()?.message ?? '', /2 partie/);
  });
  it('reports unreadable, empty and illegal games while loading valid selected games', async () => {
    state.assets = [
      {
        name: 'unreadable.pgn',
        file: {
          text: async () => {
            throw Error('no access');
          },
        },
      },
      { name: 'empty.pgn', file: { text: async () => '' } },
      { name: 'good.pgn', file: { text: async () => game('Good') } },
      {
        name: 'illegal.pgn',
        file: { text: async () => '[Event "Bad"]\n\n1. e5 *' },
      },
    ];
    let loaded: any;
    await act(async () => {
      view = create(
        <PgnImportPanel
          maxGameSelection={100}
          onLoad={(payload) => {
            loaded = payload;
          }}
        />,
      );
    });
    await press('pgn-import-pick-file');
    assert.ok(view.root.findByProps({ testID: 'pgn-import-warning-0' }));
    assert.ok(view.root.findByProps({ testID: 'pgn-import-warning-1' }));
    await selectGames([0, 1]);
    await press('pgn-import-load');
    assert.equal(loaded.games.length, 1);
    assert.equal(loaded.games[0].filename, 'good.pgn');
    assert.match(getAppDialogRequest()?.message ?? '', /3 échec/);
  });
  it('keeps prior selection and data on picker cancellation or destination write failure', async () => {
    state.assets = [
      { name: 'keep.pgn', file: { text: async () => game('Keep') } },
    ];
    let calls = 0;
    await act(async () => {
      view = create(
        <PgnImportPanel
          onLoad={async () => {
            calls++;
            throw Error('local write failed');
          }}
        />,
      );
    });
    await press('pgn-import-pick-file');
    state.cancelled = true;
    await press('pgn-import-pick-file');
    await press('pgn-import-load');
    assert.equal(calls, 1);
    assert.ok(view.root.findByProps({ testID: 'pgn-import-error' }));
    assert.ok(view.root.findByProps({ testID: 'pgn-import-selected-games' }));
    assert.equal(getAppDialogRequest(), null);
  });
  it('requires selection above ten files without reading or silently slicing them, and enforces the game cap', async () => {
    let reads = 0;
    const result = await preparePickedPgnAssets(
      Array.from({ length: 12 }, (_, i) => ({
        name: `${i}.pgn`,
        text: async () => {
          reads++;
          return game(String(i));
        },
      })),
    );
    assert.equal(result.kind, 'needsSelection');
    assert.equal(reads, 0);
    if (result.kind !== 'needsSelection') return;
    await assert.rejects(
      result.resolveSelected(result.candidates.map((c) => c.id)),
      /fileSelectionLimit/,
    );
    const picked = await result.resolveSelected(['file-10', 'file-11']);
    assert.equal(reads, 2);
    assert.equal(picked.length, 2);
    state.assets = picked.map((file) => ({
      name: file.filename,
      file: { text: async () => file.text },
    }));
    await act(async () => {
      view = create(<PgnImportPanel maxGameSelection={1} onLoad={() => {}} />);
    });
    await press('pgn-import-pick-file');
    assert.equal(
      view.root.findByType(PgnGameSelectModal).props.maxSelection,
      1,
    );
  });
  it('validates pasted FEN and reads Android file/content URIs locally with size limits', async () => {
    let loaded: any;
    await act(async () => {
      view = create(
        <PgnImportPanel
          allowFen
          onLoad={(payload) => {
            loaded = payload;
          }}
        />,
      );
    });
    await press('pgn-import-mode-fen');
    await act(async () =>
      view.root
        .findByProps({ testID: 'pgn-import-fen-input' })
        .props.onChangeText('bad FEN'),
    );
    await press('pgn-import-load');
    assert.equal(loaded, undefined);
    const fen = '8/8/8/8/8/8/4K3/7k b - - 4 42';
    await act(async () =>
      view.root
        .findByProps({ testID: 'pgn-import-fen-input' })
        .props.onChangeText(fen),
    );
    await press('pgn-import-load');
    assert.equal(loaded.fen, fen);
    for (const uri of ['file://cache/drive.pgn', 'content://downloads/42']) {
      let read = '';
      const picked = await readPgnAsset(
        { name: 'Drive.pgn', uri },
        {
          readAsStringAsync: async (u) => {
            read = u;
            return game('Drive');
          },
        },
      );
      assert.equal(read, uri);
      assert.ok(picked.text.includes('Drive'));
    }
    const large = await readPgnAsset({
      name: 'big.pgn',
      size: MAX_PGN_FILE_BYTES + 1,
      text: async () => {
        throw Error('must not read');
      },
    });
    assert.equal(large.error, 'tooLarge');
    const unknownSize = await readPgnAsset({ name: 'unicode.pgn', text: async () => 'é'.repeat(MAX_PGN_FILE_BYTES / 2 + 1) });
    assert.equal(unknownSize.error, 'tooLarge');
  });
  it('keeps successful writes when one selected game fails and shows the partial report', async () => {
    const kv = new MemoryKeyValueStorage();
    const library = new RepertoireService(
      new AsyncStorageRepertoireStorage(kv),
    );
    const folder = await library.getUnfiledFolderId();
    state.assets = ['one', 'failed', 'three'].map((name) => ({
      name: `${name}.pgn`,
      file: { text: async () => game(name) },
    }));
    await act(async () => {
      view = create(
        <PgnImportPanel
          maxGameSelection={100}
          onLoad={async (payload) => {
            if (payload.kind !== 'pgn') return;
            return importPgnBatch(payload.games, (item) => {
              if (item.filename === 'failed.pgn') throw Error('disk full');
              return library.importPgn(folder, item.filename!, item.pgnText);
            });
          }}
        />,
      );
    });
    await press('pgn-import-pick-file');
    await selectGames([0, 1, 2]);
    await press('pgn-import-load');
    assert.equal(library.getAllFiles().length, 2);
    assert.match(getAppDialogRequest()?.message ?? '', /2 partie.*1 échec/);
  });

  it('enforces the actual one-game and hundred-game selectors with a translated cap', async () => {
    for (const max of [1, 100]) {
      state.assets = [
        {
          name: 'many.pgn',
          file: {
            text: async () =>
              Array.from({ length: max + 1 }, (_, i) => game(String(i))).join(
                '\n\n',
              ),
          },
        },
      ];
      await act(async () => {
        view = create(
          <PgnImportPanel maxGameSelection={max} onLoad={() => {}} />,
        );
      });
      await press('pgn-import-pick-file');
      // Seed max-1 selections, then exercise the actual last two row presses.
      await act(async () =>
        view.root
          .findByType(PgnGameSelectModal)
          .props.onChangeSelected(
            new Set(Array.from({ length: max - 1 }, (_, i) => `g-${i}`)),
          ),
      );
      await press(`parties-game-row-g-${max - 1}`);
      await press(`parties-game-row-g-${max}`);
      assert.equal(
        view.root.findByType(PgnGameSelectModal).props.selected.size,
        max,
      );
      assert.equal(
        view.root.findByProps({ testID: 'parties-game-select-cap' }).props
          .children,
        `Maximum ${max} parties par import.`,
      );
      await act(async () => view.unmount());
    }
  });
});
