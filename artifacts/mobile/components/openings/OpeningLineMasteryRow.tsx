import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { OpeningLineMasteryView, OpeningRevisionResult } from '@/lib/repertoire';

type Props = {
  line: OpeningLineMasteryView;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
};

function marks(recent: OpeningRevisionResult[]): string {
  return recent.map((r) => (r === 'success' ? '✓' : '✗')).join(' ');
}

export function OpeningLineMasteryRow({ line, selected, onPress, testID }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const history = marks(line.recent);

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? colors.secondary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: colors.foreground }]} numberOfLines={2}>
        {line.label || t('openings.startLine')}
      </Text>
      <Text
        style={[
          styles.status,
          { color: line.mastered ? colors.primary : colors.mutedForeground },
        ]}
      >
        {line.mastered ? t('openings.lineMastered') : t('openings.lineToWork')}
      </Text>
      {history ? (
        <Text style={[styles.history, { color: colors.mutedForeground }]}>{history}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    borderWidth: 1,
    borderRadius: DesignTokens.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  status: {
    fontSize: 13,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  history: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
    letterSpacing: 1,
  },
});
