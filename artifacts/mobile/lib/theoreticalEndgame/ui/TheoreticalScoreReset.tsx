/**
 * Discreet reset links for one theoretical theme, or for every theme.
 * Confirmation goes through the shared AnyChess dialog. Cancel and Android
 * back leave the stored scores untouched.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { confirmAction } from '@/lib/openings/confirmAction';
import type { TheoreticalThemeId } from '../domain/types.ts';
import {
  resetAllTheoreticalScores,
  resetTheoreticalTheme,
} from '../persistence/TheoreticalEndgameStore.ts';

type Props = {
  themeId?: TheoreticalThemeId;
  themeTitle?: string;
  showTheme?: boolean;
  showAll?: boolean;
  onChanged?: () => void;
};

export function TheoreticalScoreReset({
  themeId,
  themeTitle,
  showTheme = false,
  showAll = false,
  onChanged,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const linkStyle = { color: colors.primary, fontSize: 13, textAlign: 'center' as const };

  const askTheme = () => {
    if (!themeId) return;
    confirmAction(
      t('quiz.theoreticalResetThemeTitle'),
      t('quiz.theoreticalResetThemeBody', { theme: themeTitle || themeId }),
      () => {
        void resetTheoreticalTheme(themeId).then(() => onChanged?.());
      },
      { destructive: true, confirmLabel: t('quiz.theoreticalResetConfirm') },
    );
  };

  const askAll = () => {
    confirmAction(
      t('quiz.theoreticalResetAllTitle'),
      t('quiz.theoreticalResetAllBody'),
      () => {
        void resetAllTheoreticalScores().then(() => onChanged?.());
      },
      { destructive: true, confirmLabel: t('quiz.theoreticalResetConfirm') },
    );
  };

  if (!showTheme && !showAll) return null;

  return (
    <View style={{ gap: 6 }}>
      {showTheme && themeId ? (
        <Pressable onPress={askTheme} hitSlop={8} testID={`theoretical-reset-theme-${themeId}`}>
          <Text style={linkStyle}>{t('quiz.theoreticalResetTheme')}</Text>
        </Pressable>
      ) : null}
      {showAll ? (
        <Pressable onPress={askAll} hitSlop={8} testID="theoretical-reset-all">
          <Text style={linkStyle}>{t('quiz.theoreticalResetAll')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
