import { tMsg } from '../i18n/tMsg.ts';
import {
  presentAppDialog,
  type AppDialogVariant,
} from '../ui/appDialogStore.ts';

/**
 * AnyChess confirmation dialog (replaces native Android and web confirms).
 * Cancel keeps the current screen; confirm runs onConfirm.
 */
export function confirmAction(
  title: string,
  message: string,
  onConfirm: () => void,
  options?: {
    confirmLabel?: string;
    cancelLabel?: string;
    destructive?: boolean;
    onCancel?: () => void;
  },
): void {
  const variant: AppDialogVariant = options?.destructive ? 'destructive' : 'confirm';
  presentAppDialog({
    title,
    message: message.trim(),
    cancelLabel: options?.cancelLabel ?? tMsg('common.cancel'),
    confirmLabel: options?.confirmLabel ?? tMsg('common.confirm'),
    variant,
    onConfirm,
    onCancel: options?.onCancel,
  });
}
