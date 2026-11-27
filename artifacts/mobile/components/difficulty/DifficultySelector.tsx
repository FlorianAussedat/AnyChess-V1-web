/**
 * Shared 2×2 difficulty picker — Débutant / Confirmé / Expert / Grand-Maître.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { Ionicons } from '@expo/vector-icons';
import {
  ANYCHESS_DIFFICULTIES,
  type AnyChessDifficultyId,
} from '@/lib/difficulty/anyChessDifficulty';
import type { MessageKey } from '@/lib/i18n';

const LABEL_KEY: Record<AnyChessDifficultyId, MessageKey> = {
  debutant: 'difficulty.debutant',
  confirme: 'difficulty.confirme',
  expert: 'difficulty.expert',
  grandMaitre: 'difficulty.grandMaitre',
};

const ICON = {
  debutant: 'school-outline',
  confirme: 'book-outline',
  expert: 'ribbon-outline',
  grandMaitre: 'trophy-outline',
} as const;

export type DifficultySelectorProps = {
  value: AnyChessDifficultyId;
  onChange: (next: AnyChessDifficultyId) => void;
  /** Restrict which levels appear (default: all four). */
  options?: readonly AnyChessDifficultyId[];
  testID?: string;
};

export function DifficultySelector({
  value,
  onChange,
  options = ANYCHESS_DIFFICULTIES,
  testID = 'difficulty-selector',
}: DifficultySelectorProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <View style={styles.grid} testID={testID}>
      {options.map((id) => {
        const selected = id === value;
        return (
          <Pressable
            key={id}
            testID={`${testID}-${id}`}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={t(LABEL_KEY[id])}
            onPress={() => onChange(id)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: selected ? 'rgba(245, 166, 35, 0.18)' : colors.card,
                borderColor: selected ? colors.primary : colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Ionicons
              name={ICON[id]}
              size={48}
              color={selected ? colors.primary : colors.foreground}
              accessible={false}
            />
            <Text style={[styles.label, { color: selected ? colors.primary : colors.foreground }]}>
              {t(LABEL_KEY[id])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single card export for custom layouts if needed. */
export function DifficultyCard({
  id,
  selected,
  onPress,
  testID,
}: {
  id: AnyChessDifficultyId;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t(LABEL_KEY[id])}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: selected ? 'rgba(245, 166, 35, 0.18)' : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name={ICON[id]}
        size={48}
        color={selected ? colors.primary : colors.foreground}
        accessible={false}
      />
      <Text style={[styles.label, { color: selected ? colors.primary : colors.foreground }]}>
        {t(LABEL_KEY[id])}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: DesignTokens.spacing.md,
    width: '100%',
  },
  card: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 2,
    borderRadius: DesignTokens.radius.card,
    paddingVertical: DesignTokens.spacing.md,
    paddingHorizontal: DesignTokens.spacing.sm,
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontFamily: DesignTokens.typography.weightSemiBold,
    textAlign: 'center',
  },
});
