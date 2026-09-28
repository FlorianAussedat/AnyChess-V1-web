/**
 * Secondary “create folder” FAB, pinned above the bottom navigation.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

export function libraryFolderFabBottomOffset(): number {
  return (
    DesignTokens.spacing.md +
    (Platform.OS === 'web' ? DesignTokens.bottomNavContentHeight : 0)
  );
}

export function LibraryFolderFab({
  label,
  accessibilityLabel,
  onPress,
  testID = 'create-folder-btn',
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        styles.fab,
        {
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
          bottom: libraryFolderFabBottomOffset(),
        },
      ]}
    >
      <Ionicons name="add" size={20} color={colors.primaryForeground} />
      <Text style={[styles.label, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: DesignTokens.spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    zIndex: 20,
  },
  label: { fontSize: 14, fontFamily: DesignTokens.typography.weightSemiBold },
});
