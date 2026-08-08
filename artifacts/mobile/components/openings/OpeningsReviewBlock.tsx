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

export function OpeningsReviewBlock({
  reviewDisabled,
  onStartReview,
  onOpenMixed,
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <View style={[styles.mixedBlock, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Text style={[styles.mixedTitle, { color: colors.foreground }]}>
        {t('openings.review')}
      </Text>
      <Text style={[styles.mixedHint, { color: colors.mutedForeground }]}>
        {t('openings.reviewHint')}
      </Text>
      <View style={styles.reviewRow}>
        <Pressable
          onPress={() => onStartReview('all')}
          disabled={reviewDisabled('all')}
          style={({ pressed }) => [
            styles.reviewBtn,
            {
              backgroundColor: colors.primary,
              opacity: reviewDisabled('all') ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
          testID="review-all-btn"
        >
          <Text
            style={{ color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }}
          >
            {t('openings.reviewAll')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onStartReview('white')}
          disabled={reviewDisabled('white')}
          style={({ pressed }) => [
            styles.reviewBtn,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: reviewDisabled('white') ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
          testID="review-white-btn"
        >
          <Text style={[styles.reviewBtnLabelMuted, { color: colors.foreground }]}>
            {t('openings.reviewWhite')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onStartReview('black')}
          disabled={reviewDisabled('black')}
          style={({ pressed }) => [
            styles.reviewBtn,
            {
              backgroundColor: colors.input,
              borderColor: colors.border,
              borderWidth: 1,
              opacity: reviewDisabled('black') ? 0.4 : pressed ? 0.75 : 1,
            },
          ]}
          testID="review-black-btn"
        >
          <Text style={[styles.reviewBtnLabelMuted, { color: colors.foreground }]}>
            {t('openings.reviewBlack')}
          </Text>
        </Pressable>
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
  reviewBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  reviewBtnLabelMuted: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  mixedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
  },
});
