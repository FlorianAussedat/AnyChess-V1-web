import type { AppDialogAction } from './appDialogStore.ts';

type BuildArgs = {
  actions?: AppDialogAction[];
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
};

/** Secondary first, then primary/destructive — Annuler left, Quitter right. */
export function rankDialogAction(action: AppDialogAction): number {
  return action.variant === 'primary' || action.variant === 'destructive' ? 1 : 0;
}

export function buildDialogActions(args: BuildArgs): AppDialogAction[] {
  if (args.actions?.length) return args.actions;
  const list: AppDialogAction[] = [];
  if (args.cancelLabel && args.onCancel) {
    list.push({
      label: args.cancelLabel,
      onPress: args.onCancel,
      variant: 'secondary',
      testID: 'app-dialog-cancel',
    });
  }
  if (args.confirmLabel && args.onConfirm) {
    list.push({
      label: args.confirmLabel,
      onPress: args.onConfirm,
      variant: 'primary',
      testID: 'app-dialog-confirm',
    });
  }
  return list;
}

export function layoutDialogActions(
  actions: AppDialogAction[],
  row: boolean,
): AppDialogAction[] {
  if (!row) return actions;
  return [...actions].sort((a, b) => rankDialogAction(a) - rankDialogAction(b));
}

/** Two actions sit in a row except on very narrow screens, where they stack. */
export function shouldUseActionRow(actionCount: number, windowWidth: number): boolean {
  return actionCount === 2 && windowWidth >= 340;
}
