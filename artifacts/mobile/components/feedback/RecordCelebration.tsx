/**
 * Lightweight personal-record celebration.
 * Uses existing brand mascot; swap internals later without changing call sites.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';
import { DesignTokens } from '@/constants/designTokens';
import { BrandAssets } from '@/constants/BrandAssets';

type Props = {
  visible: boolean;
  /** Optional override of the bouncing mascot. */
  mascotSource?: number;
  testID?: string;
};

export function RecordCelebration({
  visible,
  mascotSource,
  testID = 'record-celebration',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 320,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [visible, bounce]);

  if (!visible) return null;

  const translateY = bounce.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -18],
  });

  return (
    <View style={styles.wrap} testID={testID} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image
          source={mascotSource ?? BrandAssets.modes.classic}
          style={styles.mascot}
          resizeMode="contain"
        />
      </Animated.View>
      <Text style={[styles.label, { color: colors.primary }]}>
        {t('vision.newRecord')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  mascot: {
    width: 72,
    height: 72,
  },
  label: {
    fontSize: 16,
    fontFamily: DesignTokens.typography.weightBold,
  },
});
