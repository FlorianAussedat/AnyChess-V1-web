/**
 * Settings placeholder — architecture ready; no real options yet.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useColors } from '@/hooks/useColors';
import { useAppSafeInsets } from '@/hooks/useAppSafeInsets';
import { DesignTokens } from '@/constants/designTokens';

export default function SettingsPlaceholderScreen() {
  const colors = useColors();
  const { top: topPad, bottom: bottomPad } = useAppSafeInsets();
  const router = useRouter();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: topPad + DesignTokens.spacing.md,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      testID="settings-screen"
    >
      <ScreenHeader onBack={() => router.back()} title="Paramètres" />
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Les paramètres arriveront bientôt.
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Prévus plus tard : langue, difficulté par défaut, apparence du plateau et
          des pièces, préférences voix / son, compte.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: DesignTokens.spacing.screenX,
    gap: DesignTokens.spacing.lg,
  },
  title: {
    fontSize: DesignTokens.typography.title,
    fontFamily: 'Inter_700Bold',
  },
  card: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.lg,
    padding: DesignTokens.spacing.lg,
    gap: DesignTokens.spacing.sm,
  },
  body: {
    fontSize: DesignTokens.typography.body,
    fontFamily: 'Inter_500Medium',
    lineHeight: 22,
  },
  hint: {
    fontSize: DesignTokens.typography.caption,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
