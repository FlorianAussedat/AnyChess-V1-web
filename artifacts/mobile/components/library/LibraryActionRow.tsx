/**
 * Full-width library action used by Analyses de parties and Mes PGN d’ouverture.
 */
import React, { type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export type LibraryActionRowProps = {
  testID: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function LibraryActionRow({
  testID,
  icon,
  label,
  onPress,
  disabled = false,
}: LibraryActionRowProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed || disabled ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.primary }]}>
        <Ionicons name={icon} size={18} color={colors.primaryForeground} />
      </View>
      <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
});
