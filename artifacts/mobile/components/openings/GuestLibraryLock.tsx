/**
 * Signed-out openings library: no personal studies, and a path to an account.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { AppButton } from '@/components/ui/AppButton';
import { DesignTokens } from '@/constants/designTokens';

export function GuestLibraryLock() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.wrap} testID="openings-guest-lock">
      <Ionicons name="lock-closed-outline" size={40} color={colors.primary} />
      <Text style={[styles.title, { color: colors.foreground }]}>
        {t('openings.accountRequiredTitle')}
      </Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {t('openings.accountRequiredBody')}
      </Text>
      <AppButton
        label={t('cloud.signIn')}
        onPress={() => router.push('/utilisateur' as Href)}
        testID="openings-guest-sign-in"
        style={styles.cta}
      />
      <AppButton
        label={t('cloud.signUp')}
        onPress={() => router.push('/creer-compte' as Href)}
        testID="openings-guest-sign-up"
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
    marginTop: DesignTokens.spacing.sm,
    maxWidth: 360,
  },
});
