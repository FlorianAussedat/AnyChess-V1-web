import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import type { OpeningPgnMasteryView } from '@/lib/repertoire';

type Props = {
  view: OpeningPgnMasteryView;
  folderName?: string;
  onPress: () => void;
  onTogglePriority: () => void;
  testID?: string;
};

export function LearningPgnCard({
  view,
  folderName,
  onPress,
  onTogglePriority,
  testID,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
          {view.displayName}
        </Text>
        {folderName ? (
          <Text style={[styles.folder, { color: colors.mutedForeground }]} numberOfLines={1}>
            {folderName}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {t('openings.pgnMasteryMeta', {
            count: view.totalLines,
            percent: view.percentRounded,
          })}
        </Text>
      </View>
      <Pressable
        onPress={onTogglePriority}
        hitSlop={10}
        testID={testID ? `${testID}-priority` : 'pgn-priority'}
        accessibilityRole="button"
        accessibilityLabel={
          view.priority ? t('openings.priorityA11yOn') : t('openings.priorityA11yOff')
        }
        style={styles.starHit}
      >
        <Ionicons
          name={view.priority ? 'star' : 'star-outline'}
          size={20}
          color={view.priority ? colors.primary : colors.mutedForeground}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: DesignTokens.radius.md,
    borderWidth: 1,
  },
  body: { flex: 1, gap: 4, minWidth: 0 },
  name: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
  },
  folder: {
    fontSize: 11,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  meta: {
    fontSize: 12,
    fontFamily: DesignTokens.typography.weightRegular,
  },
  starHit: {
    padding: 4,
  },
});
