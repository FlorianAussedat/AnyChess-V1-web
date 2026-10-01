/**
 * Modal — propose adding position to « Essaie encore ! » after scored attempt.
 */
import React from 'react';
import { Text } from 'react-native';
import { AppDialog } from '@/components/ui/AppDialog';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

type Props = {
  visible: boolean;
  alreadyInPool: boolean;
  onYes: () => void;
  onNo: () => void;
  testID?: string;
};

export function TryAgainPromptModal({
  visible,
  alreadyInPool,
  onYes,
  onNo,
  testID,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  if (alreadyInPool) {
    return visible ? (
      <Text
        style={{ color: colors.mutedForeground, textAlign: 'center', fontSize: 13 }}
        testID="try-again-already"
      >
        {t('exercise.tryAgainAlready')}
      </Text>
    ) : null;
  }

  return (
    <AppDialog
      visible={visible}
      title={t('exercise.tryAgainAddTitle')}
      cancelLabel={t('common.no')}
      confirmLabel={t('common.yes')}
      onCancel={onNo}
      onConfirm={onYes}
      testID={testID ?? 'try-again-prompt'}
    />
  );
}
