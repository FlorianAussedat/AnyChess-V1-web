import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Props = {
  status: string;
  heardText: string;
  isGameOver: boolean;
  isOpponentThinking: boolean;
  thinkingLabel?: string;
};

export function GameStatusCard({
  status,
  heardText,
  isGameOver,
  isOpponentThinking,
  thinkingLabel = "L'adversaire réfléchit…",
}: Props) {
  const colors = useColors();

  return (
    <View style={[styles.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text
        numberOfLines={2}
        style={[
          styles.statusText,
          {
            color: isGameOver
              ? '#F5A623'
              : isOpponentThinking
                ? colors.mutedForeground
                : colors.foreground,
          },
        ]}
      >
        {isOpponentThinking ? thinkingLabel : status}
      </Text>
      {!!heardText && (
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
  statusText: { fontSize: 14, fontFamily: 'Inter_500Medium', lineHeight: 20 },
  heardText: { fontSize: 11, fontFamily: 'Inter_400Regular', marginTop: 3 },
});
