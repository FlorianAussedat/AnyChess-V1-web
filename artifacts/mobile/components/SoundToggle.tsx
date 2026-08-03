import React from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useAudioSettings } from '@/hooks/useAudioSettings';
import { BrandAssets } from '@/constants/BrandAssets';

/**
 * Voice / speech mute toggle (TTS only).
 * Does NOT mute validation/error SFX or haptics.
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
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {/* Prefer speech-oriented glyph overlay when muted for clarity */}
      {voiceEnabled ? (
        <Image
          source={BrandAssets.toggles.soundOn}
          style={styles.icon}
          resizeMode="contain"
        />
      ) : (
        <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
      )}
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
  icon: {
    width: 30,
    height: 30,
  },
});
