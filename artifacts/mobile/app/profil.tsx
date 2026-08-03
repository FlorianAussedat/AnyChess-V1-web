/**
 * Profile placeholder — navigation destination only (no accounts yet).
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export default function ProfilePlaceholderScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';
  const topPad = isWeb ? 67 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.page,
        {
          paddingTop: topPad + DesignTokens.spacing.xl,
          paddingBottom: bottomPad + DesignTokens.spacing.xl,
        },
      ]}
      testID="profil-screen"
    >
      <Text style={[styles.title, { color: colors.foreground }]}>Profil</Text>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>
          Le profil sera disponible plus tard.
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Aucun compte, Elo distant ou synchronisation cloud pour le moment.
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
