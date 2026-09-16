import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useTranslation } from '@/hooks/useTranslation';

type Props = {
  showRecognized: boolean;
  isListening: boolean;
  micActive: boolean;
  micMessage?: string | null;
  onToggle: () => void;
  testID?: string;
  /** Compact icon+label for dense Classic keypad layouts. Default unchanged. */
  variant?: 'default' | 'compact';
};

export function GameMicButton({
  showRecognized,
  isListening,
  micActive,
  micMessage,
  onToggle,
  testID = 'mic-btn',
  variant = 'default',
}: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const compact = variant === 'compact';

  useEffect(() => {
    if (isListening) {
      scale.value = withRepeat(
        withSequence(withTiming(1.09, { duration: 440 }), withTiming(1.0, { duration: 440 })),
        -1,
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1.0, { duration: 140 });
    }
  }, [isListening, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  let micBg: string;
  let micIconName: string;
  let micLabel: string;
  if (showRecognized) {
    micBg = '#27AE60';
    micIconName = 'checkmark-circle';
    micLabel = compact ? 'OK' : t('a11y.moveRecognized');
  } else if (isListening) {
    micBg = '#C0392B';
    micIconName = 'mic';
    micLabel = t('a11y.listening');
  } else if (micActive) {
    micBg = '#D4880A';
    micIconName = 'mic-outline';
    micLabel = t('a11y.speak');
  } else {
    micBg = colors.primary;
    micIconName = 'mic-off-outline';
    micLabel = t('a11y.speak');
  }

  return (
    <View style={[styles.micRow, compact && styles.micRowCompact]}>
      <Animated.View style={animStyle}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onToggle();
          }}
          testID={testID}
          accessibilityLabel={micLabel}
          style={({ pressed }) => [
            compact ? styles.micBtnCompact : styles.micBtn,
            { backgroundColor: micBg, opacity: pressed ? 0.82 : 1 },
          ]}
        >
          <Ionicons
            name={micIconName as keyof typeof Ionicons.glyphMap}
            size={compact ? 18 : 22}
            color="#fff"
          />
          <Text style={compact ? styles.micLabelCompact : styles.micLabel}>{micLabel}</Text>
        </Pressable>
      </Animated.View>
      {!!micMessage && (
        <Text style={[styles.permWarn, { color: '#F5A623' }]}>{micMessage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  micRow: { alignItems: 'center', gap: 6 },
  micRowCompact: { alignItems: 'stretch', flex: 1 },
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 999,
  },
  micBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  micLabel: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  micLabelCompact: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  permWarn: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
