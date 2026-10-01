import React from 'react';
import { AppDialog } from '@/components/ui/AppDialog';
import type { AppDialogAction } from '@/lib/ui/appDialogStore';

type Action = {
  label: string;
  onPress: () => void;
  testID: string;
  primary?: boolean;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title: string;
  body: string;
  actions: Action[];
  testID?: string;
};

export function OpeningChoiceModal({ visible, title, body, actions, testID }: Props) {
  const mapped: AppDialogAction[] = actions.map((action) => ({
    label: action.label,
    onPress: action.onPress,
    testID: action.testID,
    variant: action.primary ? 'primary' : action.destructive ? 'destructive' : 'secondary',
  }));
  const cancel =
    [...actions].reverse().find((a) => !a.primary && !a.destructive) ??
    actions[actions.length - 1];

  return (
    <AppDialog
      visible={visible}
      title={title}
      message={body}
      actions={mapped}
      onCancel={cancel?.onPress}
      testID={testID}
    />
  );
}
