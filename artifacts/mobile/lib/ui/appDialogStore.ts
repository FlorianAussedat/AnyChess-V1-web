/**
 * Imperative queue for AnyChess confirmation dialogs.
 * `confirmAction` writes here; `AppDialogHost` renders `AppDialog`.
 */
export type AppDialogVariant = 'confirm' | 'destructive' | 'info';

export type AppDialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
  testID?: string;
};

export type AppDialogRequest = {
  id: number;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  variant: AppDialogVariant;
  onConfirm?: () => void;
  onCancel?: () => void;
  actions?: AppDialogAction[];
};

let seq = 0;
let current: AppDialogRequest | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeAppDialog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAppDialogRequest(): AppDialogRequest | null {
  return current;
}

export function presentAppDialog(partial: Omit<AppDialogRequest, 'id'>): void {
  seq += 1;
  current = { ...partial, id: seq };
  emit();
}

export function resolveAppDialog(kind: 'confirm' | 'cancel'): void {
  const request = current;
  current = null;
  emit();
  if (!request) return;
  if (kind === 'confirm') request.onConfirm?.();
  else request.onCancel?.();
}

export function dismissAppDialog(): void {
  current = null;
  emit();
}

/** Test helper — clears queued dialog without invoking callbacks. */
export function __resetAppDialogStoreForTests(): void {
  seq = 0;
  current = null;
}
