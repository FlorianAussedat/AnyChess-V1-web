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

type Props = {
  showRecognized: boolean;
  isListening: boolean;
  micActive: boolean;
  micMessage?: string | null;
  onToggle: () => void;
  testID?: string;
};

export function GameMicButton({
  showRecognized,
  isListening,
  micActive,
  micMessage,
  onToggle,
  testID = 'mic-btn',
}: Props) {
  const colors = useColors();
  const scale = useSharedValue(1);

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
    micLabel = 'Coup reconnu';
  } else if (isListening) {
    micBg = '#C0392B';
    micIconName = 'mic';
    micLabel = 'Écoute…';
  } else if (micActive) {
    micBg = '#D4880A';
    micIconName = 'mic-outline';
    micLabel = 'Parler';
  } else {
    micBg = colors.primary;
    micIconName = 'mic-off-outline';
    micLabel = 'Parler';
  }

  return (
    <View style={styles.micRow}>
      <Animated.View style={animStyle}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onToggle();
          }}
          testID={testID}
          style={({ pressed }) => [styles.micBtn, { backgroundColor: micBg, opacity: pressed ? 0.82 : 1 }]}
        >
          <Ionicons name={micIconName as keyof typeof Ionicons.glyphMap} size={22} color="#fff" />
          <Text style={styles.micLabel}>{micLabel}</Text>
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
  micBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 13,
    borderRadius: 999,
  },
  micLabel: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  permWarn: { fontSize: 11, fontFamily: 'Inter_400Regular' },
});
