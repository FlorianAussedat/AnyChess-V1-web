/** Metadata first above ten files; selected local assets read sequentially with explicit errors. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MAX_PGN_IMPORT_BATCH } from './displayNameFromFilename.ts';
import {
  readPgnBatch,
  type PickedPgnFile,
  type PgnFileAsset,
} from '../files/readPgnFile.ts';
export type PickedPgnCandidate = {
  id: string;
  filename: string;
  text?: string;
};
export type PickPgnFilesResult =
  | { kind: 'cancelled' }
  | { kind: 'ready'; files: PickedPgnFile[] }
  | {
      kind: 'needsSelection';
      candidates: PickedPgnCandidate[];
      resolveSelected: (ids: string[]) => Promise<PickedPgnFile[]>;
    };
export async function preparePickedPgnAssets(
  assets: PgnFileAsset[],
): Promise<PickPgnFilesResult> {
  if (!assets.length) return { kind: 'cancelled' };
  if (assets.length <= MAX_PGN_IMPORT_BATCH)
    return { kind: 'ready', files: await readPgnBatch(assets) };
  return {
    kind: 'needsSelection',
    candidates: assets.map((asset, index) => ({
      id: `file-${index}`,
      filename: asset.name || `file-${index + 1}.pgn`,
    })),
    resolveSelected: async (ids) => {
      const unique = [...new Set(ids)];
      if (unique.length > MAX_PGN_IMPORT_BATCH)
        throw new Error('fileSelectionLimit');
      const selected = unique.map(
        (id) => assets[Number(id.replace(/^file-/, ''))],
      );
      if (selected.some((asset) => !asset))
        throw new Error('invalidFileSelection');
      return readPgnBatch(selected);
    },
  };
}
function pickOnWeb(): Promise<PickPgnFilesResult> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      resolve({ kind: 'cancelled' });
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      '.pgn,text/plain,application/x-chess-pgn,application/octet-stream,*/*';
    input.multiple = true;
    let settled = false,
      reading = false;
    const finish = (result: PickPgnFilesResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(result);
    };
    const onFocus = () => {
      setTimeout(() => {
        if (!reading && !input.files?.length) finish({ kind: 'cancelled' });
      }, 500);
    };
    input.oncancel = () => finish({ kind: 'cancelled' });
    input.onchange = () => {
      reading = true;
      void preparePickedPgnAssets(Array.from(input.files ?? []))
        .then(finish)
        .catch((error) => {
          window.removeEventListener('focus', onFocus);
          input.remove();
          reject(error);
        });
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
export async function pickPgnFiles(): Promise<PickPgnFilesResult> {
  if (Platform.OS === 'web') return pickOnWeb();
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: true,
  });
  if (result.canceled) return { kind: 'cancelled' };
  return preparePickedPgnAssets(result.assets ?? []);
}
