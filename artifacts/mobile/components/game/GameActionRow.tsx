import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  onRepeat: () => void;
  onUndo: () => void;
  onSummarize: () => void;
  onNewGame: () => void;
};

type Action = {
  id: string;
  label: string;
  icon: IoniconName;
  onPress: () => void;
  testID: string;
};

/**
 * Compact in-game action bar — smaller footprint, still labeled.
 */
export function GameActionRow({ onRepeat, onUndo, onSummarize, onNewGame }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const actions: Action[] = [
    {
      id: 'repeat',
      label: t('game.repeat'),
      icon: 'volume-medium-outline',
      onPress: onRepeat,
      testID: 'repeat-btn',
    },
    {
      id: 'undo',
      label: t('game.undoAction'),
      icon: 'arrow-undo-outline',
      onPress: onUndo,
      testID: 'undo-btn',
    },
    {
      id: 'summary',
      label: t('game.summary'),
      icon: 'list-outline',
      onPress: onSummarize,
      testID: 'summary-btn',
    },
    {
      id: 'new',
      label: t('game.newShort'),
      icon: 'refresh-outline',
      onPress: onNewGame,
      testID: 'new-game-btn',
    },
  ];

  return (
    <View style={styles.actionRow}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          onPress={action.onPress}
          testID={action.testID}
          accessibilityLabel={action.label}
        >
          <Ionicons name={action.icon} size={15} color={colors.foreground} />
          <Text style={[styles.actionBtnLabel, { color: colors.foreground }]} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: 5 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 40,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: DesignTokens.radius.sm,
    borderWidth: 1,
  },
  actionBtnLabel: {
    fontSize: 10,
    fontFamily: DesignTokens.typography.weightSemiBold,
    flexShrink: 1,
  },
});
