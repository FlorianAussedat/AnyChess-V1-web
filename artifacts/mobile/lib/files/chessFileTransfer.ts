import { nativeFiles, type NativeFiles } from './nativeFiles.ts';
export type ChessFileFormat = 'pgn' | 'fen';
export type ExportResult =
  | { kind: 'saved'; filename: string }
  | { kind: 'downloadStarted'; filename: string }
  | {
      kind:
        | 'copied'
        | 'sharedText'
        | 'cancelled'
        | 'unavailable'
        | 'failed'
        | 'busy';
    };
export type FileTransferRuntime = {
  platform: string;
  files: NativeFiles | null;
  document?: Pick<Document, 'createElement' | 'body'>;
  urls?: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
  shareText: (text: string) => Promise<'shared' | 'cancelled'>;
  copyText: (text: string) => Promise<boolean>;
};
let injected: FileTransferRuntime | null = null;
/** Test-only runtime; production always probes the installed client. */
export function setFileTransferRuntimeForTests(
  runtime: FileTransferRuntime | null,
) {
  injected = runtime;
}
export function fileTransferRuntime(): FileTransferRuntime {
  if (injected) return injected;
  const { Platform, Share } = require('react-native');
  return {
    platform: Platform.OS,
    files: Platform.OS === 'web' ? null : nativeFiles(),
    document: typeof document === 'undefined' ? undefined : document,
    urls: typeof URL === 'undefined' ? undefined : URL,
    shareText: async (text) => {
      const result = await Share.share({ message: text });
      return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
    },
    copyText: async (text) =>
      (await import('../clipboard.ts')).copyToClipboard(text),
  };
}
export function chessFilename(
  filename: string,
  format: ChessFileFormat,
): string {
  const base = filename
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .replace(/\.(pgn|fen)$/i, '');
  return `${base || (format === 'fen' ? 'position' : 'AnyChess')}.${format}`;
}
let busy = false;
export async function transferChessText(
  action: 'file' | 'copy' | 'share',
  filename: string,
  text: string,
  format: ChessFileFormat,
): Promise<ExportResult> {
  if (busy) return { kind: 'busy' };
  busy = true;
  let created: string | null = null;
  let fs: NativeFiles | null = null;
  try {
    if (!text.trim()) return { kind: 'failed' };
    if (
      format === 'fen' &&
      (text.trim().split(/\s+/).length !== 6 ||
        !(
          await import('../gameLibrary/validateAnalysisFen.ts')
        ).validateAnalysisFen(text).ok)
    )
      return { kind: 'failed' };
    const runtime = fileTransferRuntime();
    filename = chessFilename(filename, format);
    if (action === 'copy')
      return {
        kind: (await runtime.copyText(text)) ? 'copied' : 'unavailable',
      };
    if (action === 'share')
      return {
        kind:
          (await runtime.shareText(text)) === 'cancelled'
            ? 'cancelled'
            : 'sharedText',
      };
    const mime =
      format === 'pgn' ? 'application/x-chess-pgn' : 'application/x-chess-fen';
    if (runtime.platform === 'web') {
      if (!runtime.document || !runtime.urls?.createObjectURL)
        return { kind: 'unavailable' };
      const url = runtime.urls.createObjectURL(
        new Blob([text], { type: mime }),
      );
      const a = runtime.document.createElement('a');
      try {
        a.href = url;
        a.download = filename;
        runtime.document.body.appendChild(a);
        a.click();
      } finally {
        a.remove();
        // Give browsers time to consume the blob before releasing it.
        setTimeout(() => runtime.urls?.revokeObjectURL(url), 1000);
      }
      return { kind: 'downloadStarted', filename };
    }
    fs = runtime.files;
    if (
      runtime.platform !== 'android' ||
      !fs?.requestDirectoryPermissionsAsync ||
      !fs.createSAFFileAsync ||
      !fs.writeAsStringAsync
    )
      return { kind: 'unavailable' };
    const permission = await fs.requestDirectoryPermissionsAsync(null);
    if (!permission.granted || !permission.directoryUri)
      return { kind: 'cancelled' };
    created = await fs.createSAFFileAsync(
      permission.directoryUri,
      filename,
      mime,
    );
    await fs.writeAsStringAsync(created, text, { encoding: 'utf8' });
    return { kind: 'saved', filename };
  } catch (error) {
    if (created) {
      try {
        await fs?.deleteAsync?.(created, { idempotent: true });
      } catch {
        /* Keep original data; never delete another file. */
      }
    }
    if (error instanceof Error && /cancel|dismiss/i.test(error.message))
      return { kind: 'cancelled' };
    return { kind: 'failed' };
  } finally {
    busy = false;
  }
}
