import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

type Props = {
  onRepeat: () => void;
  onUndo: () => void;
  onSummarize: () => void;
  onNewGame: () => void;
};

export function GameActionRow({ onRepeat, onUndo, onSummarize, onNewGame }: Props) {
  const colors = useColors();
  const btn = (pressed: boolean) => [
    styles.actionBtn,
    { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.6 : 1 },
  ];

  return (
    <View style={styles.actionRow}>
      <Pressable style={({ pressed }) => btn(pressed)} onPress={onRepeat} testID="repeat-btn">
        <Ionicons name="volume-medium-outline" size={14} color={colors.foreground} />
        <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Répéter</Text>
      </Pressable>
      <Pressable style={({ pressed }) => btn(pressed)} onPress={onUndo} testID="undo-btn">
        <Ionicons name="arrow-undo-outline" size={14} color={colors.foreground} />
        <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Annuler</Text>
      </Pressable>
      <Pressable style={({ pressed }) => btn(pressed)} onPress={onSummarize} testID="summary-btn">
        <Ionicons name="list-outline" size={14} color={colors.foreground} />
        <Text style={[styles.actionBtnLabel, { color: colors.foreground }]}>Résumé</Text>
      </Pressable>
      <Pressable style={({ pressed }) => btn(pressed)} onPress={onNewGame} testID="new-game-btn">
        <Ionicons name="refresh-outline" size={14} color={colors.foreground} />
        <Text style={[styles.actionBtnLabel, { color: colors.foreground }]} numberOfLines={2}>
          Nouvelle{'\n'}partie
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 44,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionBtnLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
    flexShrink: 1,
  },
});
