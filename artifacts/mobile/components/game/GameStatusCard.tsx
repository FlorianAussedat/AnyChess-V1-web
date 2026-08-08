import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  status: string;
  heardText: string;
  isGameOver: boolean;
  isOpponentThinking: boolean;
  thinkingLabel?: string;
  /** When set (e.g. Classic keypad compose), shown as the primary line. */
  composeText?: string | null;
  compact?: boolean;
  testID?: string;
};

export function GameStatusCard({
  status,
  heardText,
  isGameOver,
  isOpponentThinking,
  thinkingLabel = "L'adversaire réfléchit…",
  composeText = null,
  compact = false,
  testID = 'game-status-card',
}: Props) {
  const colors = useColors();
  const composing = !!composeText && composeText.length > 0;
  const primary = composing
    ? composeText
    : isOpponentThinking
      ? thinkingLabel
      : status;

  return (
    <View
      testID={testID}
      style={[
        styles.statusCard,
        compact && styles.statusCardCompact,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <Text
        numberOfLines={compact ? 1 : 2}
        style={[
          styles.statusText,
          compact && styles.statusTextCompact,
          {
            color: composing
              ? colors.primary
              : isGameOver
                ? '#F5A623'
                : isOpponentThinking
                  ? colors.mutedForeground
                  : colors.foreground,
            fontFamily: composing ? 'Inter_600SemiBold' : 'Inter_500Medium',
          },
        ]}
      >
        {primary}
      </Text>
      {!composing && !!heardText && (
        <Text numberOfLines={1} style={[styles.heardText, { color: '#7BC8FF' }]}>
          Entendu : {heardText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    minHeight: 46,
    justifyContent: 'center',
  },
  statusCardCompact: {
    minHeight: 36,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statusText: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  statusTextCompact: { fontSize: 15, lineHeight: 20 },
  heardText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
});
