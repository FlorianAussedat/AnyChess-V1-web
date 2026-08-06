import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BoardCoordinatesToggle } from '@/components/BoardCoordinatesToggle';
import { BoardVisibilityToggle } from '@/components/BoardVisibilityToggle';
import { useColors } from '@/hooks/useColors';
import { DesignTokens } from '@/constants/designTokens';

type Props = {
  /** Optional context near the board (e.g. Vision côté Noirs). */
  label?: string;
  showCoordinates?: boolean;
  onToggleCoordinates?: () => void;
  boardVisible?: boolean;
  onToggleBoardVisible?: () => void;
};

/**
 * Board-adjacent toolbar for coordinates / visibility.
 * Keep these controls out of the global screen header.
 */
export function BoardToolbar({
  label,
  showCoordinates,
  onToggleCoordinates,
  boardVisible,
  onToggleBoardVisible,
}: Props) {
  const colors = useColors();
  const hasCoords = showCoordinates != null && onToggleCoordinates != null;
  const hasVisibility = boardVisible != null && onToggleBoardVisible != null;
  if (!label && !hasCoords && !hasVisibility) return null;

  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.mutedForeground }]} numberOfLines={1}>
        {label ?? ''}
      </Text>
      <View style={styles.controls}>
        {hasCoords ? (
          <BoardCoordinatesToggle visible={showCoordinates!} onToggle={onToggleCoordinates!} />
        ) : null}
        {hasVisibility ? (
          <BoardVisibilityToggle visible={boardVisible!} onToggle={onToggleBoardVisible!} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: DesignTokens.spacing.sm,
    minHeight: 36,
  },
  label: {
    flex: 1,
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: DesignTokens.spacing.sm },
});
