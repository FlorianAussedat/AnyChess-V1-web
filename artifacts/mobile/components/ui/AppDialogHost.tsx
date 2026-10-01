/**
 * Root host that renders the imperative AnyChess confirmation dialog.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import {
  dismissAppDialog,
  getAppDialogRequest,
  resolveAppDialog,
  subscribeAppDialog,
} from '@/lib/ui/appDialogStore';

export function AppDialogHost() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeAppDialog(() => setTick((n) => n + 1)), []);
  const request = getAppDialogRequest();
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
