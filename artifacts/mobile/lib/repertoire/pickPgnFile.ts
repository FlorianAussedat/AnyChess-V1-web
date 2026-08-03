/**
 * Cross-platform PGN file picker.
 *
 * Web: hidden <input type="file"> with a broad accept list so .pgn files are
 * selectable even when the OS/browser mislabels MIME types.
 *
 * Native (Android/iOS): expo-document-picker with wildcard MIME types because
 * Android often does not expose a dedicated .pgn MIME filter. Content is read
 * via fetch(uri) when possible (works for file:// cache copies and many
 * content:// URIs).
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export type PickedPgnFile = {
  filename: string;
  text: string;
};

const WEB_ACCEPT =
  '.pgn,text/plain,application/x-chess-pgn,application/octet-stream,*/*';

const NATIVE_TYPES = [
  '*/*',
  'text/plain',
  'application/octet-stream',
  'application/x-chess-pgn',
];

function pickOnWeb(): Promise<PickedPgnFile | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: PickedPgnFile | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = WEB_ACCEPT;
    input.multiple = false;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const text = await file.text();
        finish({ filename: file.name || 'lignes.pgn', text });
      } catch {
        finish(null);
      }
    };
    // Browsers rarely emit cancel; treat return-to-focus without a file as cancel.
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 400);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

async function readUriAsText(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Lecture fichier échouée (${response.status})`);
  }
  return response.text();
}

async function pickOnNative(): Promise<PickedPgnFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: NATIVE_TYPES,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const filename = asset.name || 'lignes.pgn';

  // Prefer File API when the web/native bridge exposes it.
  if (asset.file && typeof asset.file.text === 'function') {
    const text = await asset.file.text();
    return { filename, text };
  }

  const text = await readUriAsText(asset.uri);
  return { filename, text };
}

/** Open a file picker and return PGN filename + text, or null if cancelled. */
export async function pickPgnFile(): Promise<PickedPgnFile | null> {
  if (Platform.OS === 'web') {
    return pickOnWeb();
  }
  return pickOnNative();
}
