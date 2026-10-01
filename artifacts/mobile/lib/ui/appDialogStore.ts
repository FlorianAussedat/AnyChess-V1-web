/**
 * Imperative queue for AnyChess confirmation dialogs.
 * `confirmAction` writes here; `AppDialogHost` renders `AppDialog`.
 *
 * Concurrent presents are queued instead of overwriting the waiting request.
 * Android back resolves the current dialog as cancel and keeps the session.
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
const pending: AppDialogRequest[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function promoteNext(): void {
  if (current) return;
  const next = pending.shift();
  if (!next) return;
  current = next;
  emit();
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
  const request: AppDialogRequest = { ...partial, id: seq };
  if (current) {
    pending.push(request);
    return;
  }
  current = request;
  emit();
}

export function resolveAppDialog(kind: 'confirm' | 'cancel'): void {
  const request = current;
  if (!request) return;
  current = null;
  emit();
  if (kind === 'confirm') request.onConfirm?.();
  else request.onCancel?.();
  promoteNext();
}

export function dismissAppDialog(): void {
  current = null;
  emit();
  promoteNext();
}

/** Test helper — clears queued dialog without invoking callbacks. */
export function __resetAppDialogStoreForTests(): void {
  seq = 0;
  current = null;
  pending.length = 0;
}
