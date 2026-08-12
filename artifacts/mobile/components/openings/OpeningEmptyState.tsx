/**
 * Empty library state for « Apprends tes ouvertures ».
 * Parent owns storage / import; this only presents copy + CTA.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton } from '@/components/ui/AppButton';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  onImport: () => void;
  testID?: string;
};

export function OpeningEmptyState({
  onImport,
  testID = 'openings-empty-state',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.wrap} testID={testID}>
      <Ionicons
        name="documents-outline"
        size={44}
        color={colors.mutedForeground}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('openings.emptyTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t('openings.emptyLead')}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t('openings.emptySources')}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t('openings.emptyPurpose')}
      </Text>
      <AppButton
        label={t('openings.importPgn')}
        onPress={onImport}
        testID="openings-empty-import-btn"
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: DesignTokens.spacing.sm,
    paddingHorizontal: DesignTokens.spacing.xl,
    paddingVertical: DesignTokens.spacing.lg,
  },
  title: {
    fontSize: DesignTokens.typography.modeTitle,
    fontFamily: DesignTokens.typography.weightBold,
    textAlign: 'center',
    marginTop: DesignTokens.spacing.xs,
  },
  body: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
    textAlign: 'center',
    lineHeight: 19,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: DesignTokens.spacing.md,
    maxWidth: 360,
  },
});
