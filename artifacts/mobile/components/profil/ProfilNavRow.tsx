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
      <Text
        style={[styles.label, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      <View style={styles.trailing}>
        {value ? (
          <Text
            style={[styles.value, { color: colors.mutedForeground }]}
            numberOfLines={2}
          >
            {value}
          </Text>
        ) : null}
        {interactive ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.mutedForeground}
            style={styles.chevron}
          />
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
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    fontSize: 14,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
    maxWidth: '48%',
  },
  value: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: 'right',
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  chevron: {
    flexShrink: 0,
  },
});
