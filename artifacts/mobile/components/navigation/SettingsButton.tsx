/**
 * Discreet top-right settings control (placeholder destination for now).
 */
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  testID?: string;
};

export function SettingsButton({ testID = 'settings-btn' }: Props) {
  const colors = useColors();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/settings' as Href)}
      hitSlop={12}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Paramètres"
      style={({ pressed }) => [
        styles.btn,
        {
          borderColor: colors.border,
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <Ionicons name="settings-outline" size={22} color={colors.foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: DesignTokens.minTouchTarget,
    height: DesignTokens.minTouchTarget,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
