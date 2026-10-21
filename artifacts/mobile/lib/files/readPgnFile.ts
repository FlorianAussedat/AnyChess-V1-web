import { nativeFiles, type NativeFiles } from './nativeFiles.ts';
export const MAX_PGN_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_PGN_BATCH_CHARS = 16 * 1024 * 1024;
export type PickedPgnFile = {
  filename: string;
  text: string;
  error?: 'unreadable' | 'tooLarge' | 'empty';
};
export type PgnFileAsset = {
  name?: string;
  uri?: string;
  size?: number;
  file?: { text: () => Promise<string> };
  text?: () => Promise<string>;
};
function exceedsUtf8Limit(text: string): boolean {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code < 0x80) bytes++;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
    if (bytes > MAX_PGN_FILE_BYTES) return true;
  }
  return false;
}

/** Local reads only. DocumentPicker must copy cloud-provider files to its cache first. */
export async function readPgnAsset(
  asset: PgnFileAsset,
  fs: NativeFiles | null = nativeFiles(),
): Promise<PickedPgnFile> {
  const filename = asset.name || 'AnyChess.pgn';
  try {
    if ((asset.size ?? 0) > MAX_PGN_FILE_BYTES)
      return { filename, text: '', error: 'tooLarge' };
    let text: string;
    if (asset.file?.text) text = await asset.file.text();
    else if (asset.text) text = await asset.text();
    else {
      if (
        !asset.uri ||
        !/^(file|content):\/\//.test(asset.uri) ||
        !fs?.readAsStringAsync
      )
        return { filename, text: '', error: 'unreadable' };
      if (fs.getInfoAsync) {
        const info = await fs
          .getInfoAsync(asset.uri, {})
          .catch(() => ({
            exists: true,
            size: undefined as number | undefined,
          }));
        if (!info.exists && asset.uri.startsWith('file://'))
          return { filename, text: '', error: 'unreadable' };
        if ((info.size ?? 0) > MAX_PGN_FILE_BYTES)
          return { filename, text: '', error: 'tooLarge' };
      }
      text = await fs.readAsStringAsync(asset.uri, { encoding: 'utf8' });
    }
    if (text.length > MAX_PGN_FILE_BYTES || exceedsUtf8Limit(text))
      return { filename, text: '', error: 'tooLarge' };
    return {
      filename,
      text,
      ...(!text.trim() ? { error: 'empty' as const } : {}),
    };
  } catch {
    return { filename, text: '', error: 'unreadable' };
  }
}
export async function readPgnBatch(
  assets: PgnFileAsset[],
): Promise<PickedPgnFile[]> {
  const results: PickedPgnFile[] = [];
  let total = 0;
  for (const asset of assets) {
    const file = await readPgnAsset(asset);
    total += file.text.length;
    results.push(
      total > MAX_PGN_BATCH_CHARS
        ? { filename: file.filename, text: '', error: 'tooLarge' }
        : file,
    );
  }
  return results;
}
