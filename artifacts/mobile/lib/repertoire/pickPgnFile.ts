/** Single-file entry for the external opening editor; unlike multi-import it never offers multiple files. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { readPgnAsset, type PickedPgnFile } from '../files/readPgnFile.ts';
export type { PickedPgnFile } from '../files/readPgnFile.ts';
export async function pickPgnFile(): Promise<PickedPgnFile | null> {
  let picked: PickedPgnFile | null;
  if (Platform.OS === 'web') {
    picked = await new Promise<PickedPgnFile | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept =
        '.pgn,text/plain,application/x-chess-pgn,application/octet-stream,*/*';
      input.multiple = false;
      let reading = false,
        settled = false;
      const finish = (file: PickedPgnFile | null) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('focus', focus);
        input.remove();
        resolve(file);
      };
      const focus = () =>
        setTimeout(() => {
          if (!reading && !input.files?.length) finish(null);
        }, 500);
      input.oncancel = () => finish(null);
      input.onchange = () => {
        reading = true;
        const file = input.files?.[0];
        if (!file) finish(null);
        else void readPgnAsset(file).then(finish);
      };
      window.addEventListener('focus', focus);
      input.click();
    });
  } else {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });
    picked =
      result.canceled || !result.assets?.[0]
        ? null
        : await readPgnAsset(result.assets[0]);
  }
  if (picked?.error) throw new Error(picked.error);
  return picked;
}
