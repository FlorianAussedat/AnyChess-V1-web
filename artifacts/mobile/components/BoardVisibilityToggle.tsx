import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';

interface Props {
  visible: boolean;
  onToggle: () => void;
}

/**
 * Board show/hide — temporary Ionicons until custom assets arrive.
 */
export function BoardVisibilityToggle({ visible, onToggle }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={10}
      testID="board-visibility-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: visible }}
      accessibilityLabel={visible ? t('a11y.boardHide') : t('a11y.boardShow')}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: visible ? colors.primary : colors.card,
          borderColor: visible ? colors.primary : colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons
        name={visible ? 'eye-outline' : 'eye-off-outline'}
        size={20}
        color={visible ? colors.primaryForeground : colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: DesignTokens.headerIconButton + 4,
    height: DesignTokens.headerIconButton + 4,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
