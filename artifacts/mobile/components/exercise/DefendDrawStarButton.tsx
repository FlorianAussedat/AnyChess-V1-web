import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

/** Same star / star-outline convention as the opening lines. */
export function DefendDrawStarButton({
  starred,
  onPress,
  testID = 'endgame-star',
}: {
  starred: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const colors = useColors();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={starred ? t('quiz.ddStarRemove') : t('quiz.ddStarAdd')}
      testID={testID}
    >
      <Ionicons
        name={starred ? 'star' : 'star-outline'}
        size={22}
        color={starred ? colors.primary : colors.mutedForeground}
      />
    </Pressable>
  );
}
