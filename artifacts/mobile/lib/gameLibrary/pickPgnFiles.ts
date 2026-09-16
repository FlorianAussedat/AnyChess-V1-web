/**
 * Multi-file PGN picker (web + native). Caps at MAX_PGN_IMPORT_BATCH.
 * When more than 10 files are selected, returns `needsSelection` with metadata
 * only (no PGN text) so callers can present a chooser without loading all blobs.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { MAX_PGN_IMPORT_BATCH } from './displayNameFromFilename.ts';
import type { PickedPgnFile } from '../repertoire/pickPgnFile.ts';

export type PickedPgnCandidate = {
  /** Stable id for selection UI (index in original FileList / assets). */
  id: string;
  filename: string;
  /** Present when text was already read (≤10 files). */
  text?: string;
};

export type PickPgnFilesResult =
  | { kind: 'cancelled' }
  | { kind: 'ready'; files: PickedPgnFile[] }
  | {
      kind: 'needsSelection';
      candidates: PickedPgnCandidate[];
      /** Resolve selected ids → PickedPgnFile by reading deferred File/Asset. */
      resolveSelected: (ids: string[]) => Promise<PickedPgnFile[]>;
    };

const WEB_ACCEPT =
  '.pgn,text/plain,application/x-chess-pgn,application/octet-stream,*/*';

const NATIVE_TYPES = [
  '*/*',
  'text/plain',
  'application/octet-stream',
  'application/x-chess-pgn',
];

async function readUriAsText(uri: string): Promise<string> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Lecture fichier échouée (${response.status})`);
  }
  return response.text();
}

function pickOnWeb(): Promise<PickPgnFilesResult> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ kind: 'cancelled' });
      return;
    }
    let settled = false;
    const finish = (value: PickPgnFilesResult) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = WEB_ACCEPT;
    input.multiple = true;
    input.onchange = async () => {
      const list = input.files;
      if (!list || list.length === 0) {
        finish({ kind: 'cancelled' });
        return;
      }
      const files = Array.from(list);
      if (files.length <= MAX_PGN_IMPORT_BATCH) {
        const ready: PickedPgnFile[] = [];
        for (const file of files) {
          try {
            ready.push({
              filename: file.name || 'lignes.pgn',
              text: await file.text(),
            });
          } catch {
            /* skip unreadable */
          }
        }
        finish(
          ready.length > 0
            ? { kind: 'ready', files: ready }
            : { kind: 'cancelled' },
        );
        return;
      }

      const candidates: PickedPgnCandidate[] = files.map((file, i) => ({
        id: `web-${i}`,
        filename: file.name || `file-${i + 1}.pgn`,
      }));

      finish({
        kind: 'needsSelection',
        candidates,
        resolveSelected: async (ids) => {
          const selected = ids.slice(0, MAX_PGN_IMPORT_BATCH);
          const out: PickedPgnFile[] = [];
          for (const id of selected) {
            const idx = Number(id.replace('web-', ''));
            const file = files[idx];
            if (!file) continue;
            try {
              out.push({
                filename: file.name || 'lignes.pgn',
                text: await file.text(),
              });
            } catch {
              /* skip */
            }
          }
          return out;
        },
      });
    };
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) finish({ kind: 'cancelled' });
      }, 400);
    };
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

async function pickOnNative(): Promise<PickPgnFilesResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: NATIVE_TYPES,
    copyToCacheDirectory: true,
    multiple: true,
  });

  if (result.canceled || !result.assets?.length) {
    return { kind: 'cancelled' };
  }

  const assets = result.assets;
  if (assets.length <= MAX_PGN_IMPORT_BATCH) {
    const ready: PickedPgnFile[] = [];
    for (const asset of assets) {
      const filename = asset.name || 'lignes.pgn';
      try {
        let text: string;
        if (asset.file && typeof asset.file.text === 'function') {
          text = await asset.file.text();
        } else {
          text = await readUriAsText(asset.uri);
        }
        ready.push({ filename, text });
      } catch {
        /* skip */
      }
    }
    return ready.length > 0
      ? { kind: 'ready', files: ready }
      : { kind: 'cancelled' };
  }

  const candidates: PickedPgnCandidate[] = assets.map((asset, i) => ({
    id: `nat-${i}`,
    filename: asset.name || `file-${i + 1}.pgn`,
  }));

  return {
    kind: 'needsSelection',
    candidates,
    resolveSelected: async (ids) => {
      const selected = ids.slice(0, MAX_PGN_IMPORT_BATCH);
      const out: PickedPgnFile[] = [];
      for (const id of selected) {
        const idx = Number(id.replace('nat-', ''));
        const asset = assets[idx];
        if (!asset) continue;
        const filename = asset.name || 'lignes.pgn';
        try {
          let text: string;
          if (asset.file && typeof asset.file.text === 'function') {
            text = await asset.file.text();
          } else {
            text = await readUriAsText(asset.uri);
          }
          out.push({ filename, text });
        } catch {
          /* skip */
        }
      }
      return out;
    },
  };
}

/** Multi-select PGN picker with a hard cap of MAX_PGN_IMPORT_BATCH. */
export async function pickPgnFiles(): Promise<PickPgnFilesResult> {
  if (Platform.OS === 'web') return pickOnWeb();
  return pickOnNative();
}
