import { presentAppDialog } from '../ui/appDialogStore.ts';
import { tMsg } from '../i18n/tMsg.ts';
import {
  fileTransferRuntime,
  transferChessText,
  type ChessFileFormat,
  type ExportResult,
} from './chessFileTransfer.ts';
import type { MessageKey } from '../i18n/messages.ts';
export function exportResultKey(result: ExportResult): MessageKey | null {
  switch (result.kind) {
    case 'saved':
      return 'files.saved';
    case 'downloadStarted':
      return 'files.downloadStarted';
    case 'copied':
      return 'files.copied';
    case 'sharedText':
      return 'files.sharedText';
    case 'unavailable':
      return 'files.unavailable';
    case 'failed':
      return 'files.failed';
    default:
      return null;
  }
}
let choosing = false;
/** Every legacy export entry now has explicit file / text / copy actions and real outcomes. */
export async function requestChessExport(
  filename: string,
  text: string,
  format: ChessFileFormat = 'pgn',
): Promise<ExportResult> {
  if (choosing) return { kind: 'busy' };
  choosing = true;
  try {
    const action =
      fileTransferRuntime().platform === 'web'
        ? 'file'
        : await new Promise<'file' | 'copy' | 'share' | null>((resolve) => {
            presentAppDialog({
              title: tMsg('files.export'),
              message: tMsg('files.chooseAction'),
              variant: 'info',
              onCancel: () => resolve(null),
              actions: [
                ...(['file', 'share', 'copy'] as const).map((action) => ({
                  label: tMsg(
                    action === 'file'
                      ? 'files.save'
                      : action === 'share'
                        ? 'files.share'
                        : 'files.copy',
                  ),
                  onPress: () => resolve(action),
                  testID: `chess-export-${action}`,
                })),
                { label: tMsg('common.cancel'), onPress: () => resolve(null) },
              ],
            });
          });
    if (!action) return { kind: 'cancelled' };
    const result = await transferChessText(action, filename, text, format);
    const key = exportResultKey(result);
    if (key)
      presentAppDialog({
        title: tMsg('files.export'),
        message: tMsg(key),
        variant: 'info',
        actions: [
          ...(result.kind === 'failed' || result.kind === 'unavailable'
            ? [
                {
                  label: tMsg('files.retry'),
                  onPress: () => {
                    void requestChessExport(filename, text, format);
                  },
                },
              ]
            : []),
          { label: tMsg('common.close'), onPress: () => {} },
        ],
      });
    return result;
  } finally {
    choosing = false;
  }
}
export function requestPgnExport(
  filename: string,
  pgn: string,
): Promise<ExportResult> {
  return requestChessExport(filename, pgn, 'pgn');
}
