/**
 * Root host that renders the imperative AnyChess confirmation dialog.
 * useSyncExternalStore reads the current request on mount so a dialog
 * presented before subscribe is still visible after remount.
 */
import React, { useMemo, useSyncExternalStore } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import {
  dismissAppDialog,
  getAppDialogRequest,
  resolveAppDialog,
  subscribeAppDialog,
} from '@/lib/ui/appDialogStore';

export function AppDialogHost() {
  const request = useSyncExternalStore(
    subscribeAppDialog,
    getAppDialogRequest,
    getAppDialogRequest,
  );
  const actions = useMemo(
    () =>
      request?.actions?.map((action) => ({
        ...action,
        onPress: () => {
          dismissAppDialog();
          action.onPress();
        },
      })),
    [request],
  );

  return (
    <AppDialog
      visible={Boolean(request)}
      title={request?.title ?? ''}
      message={request?.message}
      cancelLabel={request?.cancelLabel}
      confirmLabel={request?.confirmLabel}
      variant={request?.variant ?? 'confirm'}
      actions={actions}
      onCancel={() => resolveAppDialog('cancel')}
      onConfirm={() => resolveAppDialog('confirm')}
      dismissOnBackdrop={false}
      testID="app-dialog-host"
    />
  );
}
