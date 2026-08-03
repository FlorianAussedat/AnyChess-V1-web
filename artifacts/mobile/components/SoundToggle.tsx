import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';

/**
 * Voice / speech mute toggle (TTS only).
 * Does NOT mute validation/error SFX or haptics.
 * Uses speech-oriented Ionicons (chatbubbles), never volume/speaker glyphs.
 */
export function SoundToggle() {
  const colors = useColors();
  const { voiceEnabled, toggleVoice } = useAudioSettings();

  return (
    <Pressable
      onPress={() => {
        toggleVoice().catch(() => {});
      }}
      hitSlop={10}
      testID="sound-toggle"
      accessibilityRole="switch"
      accessibilityState={{ checked: voiceEnabled }}
      accessibilityLabel={voiceEnabled ? 'Couper la voix' : 'Activer la voix'}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.6 : voiceEnabled ? 1 : 0.55,
        },
      ]}
    >
      <Ionicons
        name={voiceEnabled ? 'chatbubbles' : 'chatbubbles-outline'}
        size={22}
        color={voiceEnabled ? colors.primary : colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
