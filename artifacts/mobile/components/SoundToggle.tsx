import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';

/**
 * Global sound toggle (speaker / muted speaker).
 * Independent from board visibility and microphone state.
 */
export function SoundToggle() {
  const colors = useColors();
  const { soundEnabled, toggleSound } = useAudioSettings();

  return (
    <Pressable
      onPress={() => {
        toggleSound().catch(() => {});
      }}
      hitSlop={10}
      testID="sound-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: soundEnabled }}
      accessibilityLabel={soundEnabled ? 'Couper le son' : 'Activer le son'}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: soundEnabled ? colors.card : colors.primary,
          borderColor: soundEnabled ? colors.border : colors.primary,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <Ionicons
        name={soundEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
        size={20}
        color={soundEnabled ? colors.foreground : colors.primaryForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
