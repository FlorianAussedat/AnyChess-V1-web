import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import type { ReviewSideFilter } from '@/lib/repertoire';

type Props = {
  reviewDisabled: (side: ReviewSideFilter) => boolean;
  onStartReview: (side: ReviewSideFilter) => void;
  onOpenMixed: () => void;
};

/**
 * Three equivalent review filters — same primary (orange) style when enabled;
 * unavailable sides stay visible but grey/disabled.
 */
export function OpeningsReviewBlock({
  reviewDisabled,
  onStartReview,
  onOpenMixed,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  const renderReviewBtn = (
    side: ReviewSideFilter,
    label: string,
    testID: string,
  ) => {
    const disabled = reviewDisabled(side);
    return (
      <Pressable
        onPress={() => onStartReview(side)}
        disabled={disabled}
        style={({ pressed }) => [
          styles.reviewBtn,
          {
            backgroundColor: disabled ? colors.input : colors.primary,
            borderColor: disabled ? colors.border : colors.primary,
            borderWidth: 1,
            opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
          },
        ]}
        testID={testID}
        accessibilityState={{ disabled }}
      >
        <Text
          style={{
            color: disabled ? colors.mutedForeground : colors.primaryForeground,
            fontFamily: 'Inter_600SemiBold',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.mixedBlock, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.mixedTitle, { color: colors.foreground }]}>
        {t('openings.review')}
      </Text>
      <Text style={[styles.mixedHint, { color: colors.mutedForeground }]}>
        {t('openings.reviewHint')}
      </Text>
      <View style={styles.reviewRow}>
        {renderReviewBtn('all', t('openings.reviewAll'), 'review-all-btn')}
        {renderReviewBtn('white', t('openings.reviewWhite'), 'review-white-btn')}
        {renderReviewBtn('black', t('openings.reviewBlack'), 'review-black-btn')}
      </View>
      <Pressable
        onPress={onOpenMixed}
        style={({ pressed }) => [
          styles.mixedBtn,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
        testID="mixed-training-btn"
      >
        <Ionicons name="shuffle-outline" size={18} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}>
          {t('openings.customSelection')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mixedBlock: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  mixedTitle: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  mixedHint: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  reviewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reviewBtn: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
