import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  label: string;
  value?: string;
  onPress?: () => void;
  testID?: string;
  /** When false, row is informational (no chevron / press). */
  interactive?: boolean;
};

/** Compact settings-style row used on the Profil hub. */
export function ProfilNavRow({
  label,
  value,
  onPress,
  testID,
  interactive = true,
}: Props) {
  const colors = useColors();
  const content = (
    <>
      <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.trailing}>
        {value ? (
          <Text style={[styles.value, { color: colors.mutedForeground }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {interactive ? (
          <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
        ) : null}
      </View>
    </>
  );

  if (!interactive || !onPress) {
    return (
      <View
        style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
        testID={testID}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: DesignTokens.spacing.lg,
    paddingVertical: DesignTokens.spacing.md,
    minHeight: DesignTokens.minTouchTarget,
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '55%',
  },
  value: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
  },
});
